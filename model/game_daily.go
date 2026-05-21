package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	GameDailyPlayLimit             = 50
	GameDailyReliefThresholdAmount = 50
	GameDailyReliefAmount          = 10
	gameDailyLocationName          = "Asia/Shanghai"
)

type GameDailyUserState struct {
	Id              int    `json:"id"`
	UserId          int    `json:"user_id" gorm:"index;uniqueIndex:idx_game_daily_user_date"`
	StatDate        string `json:"stat_date" gorm:"type:varchar(16);index;uniqueIndex:idx_game_daily_user_date"`
	PlayCount       int    `json:"play_count" gorm:"default:0"`
	NetQuota        int    `json:"net_quota" gorm:"default:0"`
	ReliefClaimed   bool   `json:"relief_claimed" gorm:"default:false"`
	ReliefQuota     int    `json:"relief_quota" gorm:"default:0"`
	ReliefClaimedAt int64  `json:"relief_claimed_at" gorm:"bigint;default:0;index"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type GameDailyLimitView struct {
	PlayLimit       int     `json:"play_limit"`
	PlayCount       int     `json:"play_count"`
	RemainingCount  int     `json:"remaining_count"`
	NetQuota        int     `json:"net_quota"`
	NetBalance      float64 `json:"net_balance"`
	ReliefThreshold float64 `json:"relief_threshold"`
	ReliefAmount    float64 `json:"relief_amount"`
	ReliefClaimed   bool    `json:"relief_claimed"`
	CanClaimRelief  bool    `json:"can_claim_relief"`
}

type GameReliefClaimResult struct {
	DailyLimit   GameDailyLimitView `json:"daily_limit"`
	UserQuota    int                `json:"user_quota"`
	UserBalance  float64            `json:"user_balance"`
	ReliefQuota  int                `json:"relief_quota"`
	ReliefAmount float64            `json:"relief_amount"`
}

func gameDailyDateNow() string {
	location, err := time.LoadLocation(gameDailyLocationName)
	if err != nil {
		location = time.FixedZone("CST", 8*60*60)
	}
	return time.Now().In(location).Format("2006-01-02")
}

func getOrCreateGameDailyUserState(tx *gorm.DB, userId int) (*GameDailyUserState, error) {
	statDate := gameDailyDateNow()
	var state GameDailyUserState
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ? AND stat_date = ?", userId, statDate).
		First(&state).Error
	if err == nil {
		return &state, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	state = GameDailyUserState{
		UserId:   userId,
		StatDate: statDate,
	}
	if err := tx.Create(&state).Error; err != nil {
		return nil, err
	}
	return &state, nil
}

func ensureGameDailyPlayAvailable(tx *gorm.DB, userId int) (*GameDailyUserState, error) {
	state, err := getOrCreateGameDailyUserState(tx, userId)
	if err != nil {
		return nil, err
	}
	if state.PlayCount >= GameDailyPlayLimit {
		return nil, fmt.Errorf("今日游戏次数已达上限（%d/%d）", state.PlayCount, GameDailyPlayLimit)
	}
	return state, nil
}

func recordGameDailyPlay(state *GameDailyUserState, netQuotaDelta int) {
	state.PlayCount++
	state.NetQuota += netQuotaDelta
}

func recordGameDailyNetQuota(tx *gorm.DB, userId int, netQuotaDelta int) error {
	if netQuotaDelta == 0 {
		return nil
	}
	state, err := getOrCreateGameDailyUserState(tx, userId)
	if err != nil {
		return err
	}
	state.NetQuota += netQuotaDelta
	return tx.Save(state).Error
}

func gameDailyLimitViewFromState(state *GameDailyUserState) GameDailyLimitView {
	if state == nil {
		state = &GameDailyUserState{}
	}
	remaining := GameDailyPlayLimit - state.PlayCount
	if remaining < 0 {
		remaining = 0
	}
	thresholdQuota := amountToQuota(GameDailyReliefThresholdAmount)
	return GameDailyLimitView{
		PlayLimit:       GameDailyPlayLimit,
		PlayCount:       state.PlayCount,
		RemainingCount:  remaining,
		NetQuota:        state.NetQuota,
		NetBalance:      quotaToAmount(state.NetQuota),
		ReliefThreshold: GameDailyReliefThresholdAmount,
		ReliefAmount:    GameDailyReliefAmount,
		ReliefClaimed:   state.ReliefClaimed,
		CanClaimRelief:  state.NetQuota <= -thresholdQuota && !state.ReliefClaimed,
	}
}

func GetGameDailyLimit(userId int) (GameDailyLimitView, error) {
	state, err := getOrCreateGameDailyUserState(DB, userId)
	if err != nil {
		return GameDailyLimitView{}, err
	}
	return gameDailyLimitViewFromState(state), nil
}

func ClaimGameRelief(userId int) (*GameReliefClaimResult, error) {
	var result *GameReliefClaimResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		state, err := getOrCreateGameDailyUserState(tx, userId)
		if err != nil {
			return err
		}
		limitView := gameDailyLimitViewFromState(state)
		if !limitView.CanClaimRelief {
			return errors.New("当前不满足救助资金领取条件")
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		reliefQuota := amountToQuota(GameDailyReliefAmount)
		user.Quota += reliefQuota
		state.NetQuota += reliefQuota
		state.ReliefClaimed = true
		state.ReliefQuota = reliefQuota
		state.ReliefClaimedAt = common.GetTimestamp()

		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if err := tx.Save(state).Error; err != nil {
			return err
		}

		result = &GameReliefClaimResult{
			DailyLimit:   gameDailyLimitViewFromState(state),
			UserQuota:    user.Quota,
			UserBalance:  quotaToAmount(user.Quota),
			ReliefQuota:  reliefQuota,
			ReliefAmount: quotaToAmount(reliefQuota),
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("领取游戏救助资金 %.2f 站内余额", result.ReliefAmount))
	return result, nil
}
