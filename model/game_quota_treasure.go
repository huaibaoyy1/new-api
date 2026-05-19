package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	GameKeyQuotaTreasure = "quota-treasure"

	QuotaTreasureStatusPlaying = "playing"
	QuotaTreasureStatusSettled = "settled"
	QuotaTreasureStatusFailed  = "failed"

	QuotaTreasureResultCashout   = "cashout"
	QuotaTreasureResultCompleted = "completed"
	QuotaTreasureResultFailed    = "failed"

	QuotaTreasureMaxLayer        = 7
	QuotaTreasureNodeCount       = 4
	QuotaTreasureMaxPayoutAmount = 50
)

var quotaTreasureBetAmounts = []int{1, 5, 10}
var quotaTreasureMultipliers = []float64{1.15, 1.35, 1.6, 2.0, 2.6, 3.6, 5.0}
var quotaTreasureSuccessRates = []int{72, 62, 52, 42, 34, 26, 18}

var quotaTreasureRoll = func(layer int, position int) bool {
	successRate := quotaTreasureSuccessRates[layer-1]
	return rand.Intn(100) < successRate
}

var quotaTreasureRules = []string{
	"选择 1、5 或 10 站内余额入场，进入 7 层额度遗迹。",
	"每层从 4 个隐藏节点中选择 1 个，成功可继续探宝或带走当前奖励。",
	"探宝失败时本局结束，不返还入场额。",
	"第 7 层成功后自动结算奖励，单局最高派奖 50 站内余额。",
}

type GameTreasureRound struct {
	Id                int     `json:"id"`
	UserId            int     `json:"user_id" gorm:"index"`
	GameKey           string  `json:"game_key" gorm:"type:varchar(64);index"`
	Status            string  `json:"status" gorm:"type:varchar(32);index"`
	Result            string  `json:"result" gorm:"type:varchar(32)"`
	BetAmount         int     `json:"bet_amount" gorm:"default:0"`
	BetQuota          int     `json:"bet_quota" gorm:"default:0"`
	CurrentLayer      int     `json:"current_layer" gorm:"default:0"`
	CurrentMultiplier float64 `json:"current_multiplier" gorm:"default:0"`
	Steps             string  `json:"-" gorm:"type:text"`
	PayoutQuota       int     `json:"payout_quota" gorm:"default:0"`
	PayoutAmount      float64 `json:"payout_amount" gorm:"default:0"`
	CreatedAt         int64   `json:"created_at" gorm:"bigint;autoCreateTime;index"`
	SettledAt         int64   `json:"settled_at" gorm:"bigint;index"`
}

type QuotaTreasureStep struct {
	Layer        int     `json:"layer"`
	Position     int     `json:"position"`
	Outcome      string  `json:"outcome"`
	Multiplier   float64 `json:"multiplier"`
	PayoutAmount float64 `json:"payout_amount"`
}

type QuotaTreasureRoundView struct {
	Id                  int                 `json:"id"`
	Status              string              `json:"status"`
	Result              string              `json:"result,omitempty"`
	BetAmount           int                 `json:"bet_amount"`
	CurrentLayer        int                 `json:"current_layer"`
	CurrentMultiplier   float64             `json:"current_multiplier"`
	CurrentPayoutAmount float64             `json:"current_payout_amount"`
	Steps               []QuotaTreasureStep `json:"steps"`
	PayoutQuota         int                 `json:"payout_quota"`
	PayoutAmount        float64             `json:"payout_amount"`
	CreatedAt           int64               `json:"created_at"`
	SettledAt           int64               `json:"settled_at,omitempty"`
	UserQuota           int                 `json:"user_quota,omitempty"`
	UserBalance         float64             `json:"user_balance,omitempty"`
	CanPick             bool                `json:"can_pick"`
	CanCashout          bool                `json:"can_cashout"`
}

type QuotaTreasureStatus struct {
	Enabled      bool                     `json:"enabled"`
	GameKey      string                   `json:"game_key"`
	Title        string                   `json:"title"`
	BetAmounts   []int                    `json:"bet_amounts"`
	UserQuota    int                      `json:"user_quota"`
	UserBalance  float64                  `json:"user_balance"`
	CurrentRound *QuotaTreasureRoundView  `json:"current_round,omitempty"`
	RecentRounds []QuotaTreasureRoundView `json:"recent_rounds"`
	Rules        []string                 `json:"rules"`
	MaxLayer     int                      `json:"max_layer"`
	MaxPayout    int                      `json:"max_payout"`
	Multipliers  []float64                `json:"multipliers"`
	NodeCount    int                      `json:"node_count"`
}

func IsQuotaTreasureEnabled() bool {
	return IsGamesEnabled() && common.GetEnvOrDefaultBool("GAME_THREE_ENABLED", true)
}

func GetQuotaTreasureStatus(userId int) (*QuotaTreasureStatus, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}

	var current GameTreasureRound
	var currentView *QuotaTreasureRoundView
	err = DB.Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyQuotaTreasure, QuotaTreasureStatusPlaying).
		Order("id desc").
		First(&current).Error
	if err == nil {
		view, err := quotaTreasureRoundToView(&current)
		if err != nil {
			return nil, err
		}
		view.UserQuota = userQuota
		view.UserBalance = quotaToAmount(userQuota)
		currentView = view
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var rounds []GameTreasureRound
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyQuotaTreasure).
		Order("id desc").
		Limit(20).
		Find(&rounds).Error; err != nil {
		return nil, err
	}

	recent := make([]QuotaTreasureRoundView, 0, len(rounds))
	for _, round := range rounds {
		view, err := quotaTreasureRoundToView(&round)
		if err != nil {
			return nil, err
		}
		recent = append(recent, *view)
	}

	return &QuotaTreasureStatus{
		Enabled:      IsQuotaTreasureEnabled(),
		GameKey:      GameKeyQuotaTreasure,
		Title:        "额度探宝",
		BetAmounts:   quotaTreasureBetAmounts,
		UserQuota:    userQuota,
		UserBalance:  quotaToAmount(userQuota),
		CurrentRound: currentView,
		RecentRounds: recent,
		Rules:        quotaTreasureRules,
		MaxLayer:     QuotaTreasureMaxLayer,
		MaxPayout:    QuotaTreasureMaxPayoutAmount,
		Multipliers:  quotaTreasureMultipliers,
		NodeCount:    QuotaTreasureNodeCount,
	}, nil
}

func CreateQuotaTreasureRound(userId int, betAmount int) (*QuotaTreasureRoundView, error) {
	if !isQuotaTreasureBetAmountAllowed(betAmount) {
		return nil, errors.New("入场额无效")
	}

	var result *QuotaTreasureRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing GameTreasureRound
		err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyQuotaTreasure, QuotaTreasureStatusPlaying).
			First(&existing).Error
		if err == nil {
			return errors.New("已有未结束探宝，请先完成当前探宝")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		betQuota := amountToQuota(float64(betAmount))
		if user.Quota < betQuota {
			return errors.New("站内余额不足")
		}
		user.Quota -= betQuota

		stepsJSON, err := marshalQuotaTreasureSteps([]QuotaTreasureStep{})
		if err != nil {
			return err
		}
		round := GameTreasureRound{
			UserId:    userId,
			GameKey:   GameKeyQuotaTreasure,
			Status:    QuotaTreasureStatusPlaying,
			BetAmount: betAmount,
			BetQuota:  betQuota,
			Steps:     stepsJSON,
		}
		if err := tx.Create(&round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		view, err := quotaTreasureRoundToView(&round)
		if err != nil {
			return err
		}
		view.UserQuota = user.Quota
		view.UserBalance = quotaToAmount(user.Quota)
		result = view
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度探宝入场 %d 站内余额", betAmount))
	return result, nil
}

func PickQuotaTreasureNode(userId int, roundId int, position int) (*QuotaTreasureRoundView, error) {
	if position < 0 || position >= QuotaTreasureNodeCount {
		return nil, errors.New("探宝节点无效")
	}

	var result *QuotaTreasureRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockQuotaTreasureRound(tx, userId, roundId)
		if err != nil {
			return err
		}
		if round.Status != QuotaTreasureStatusPlaying {
			return errors.New("本局探宝已结束")
		}
		if round.CurrentLayer >= QuotaTreasureMaxLayer {
			return errors.New("本局探宝已达到最高层")
		}

		steps, err := unmarshalQuotaTreasureSteps(round.Steps)
		if err != nil {
			return err
		}
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		nextLayer := round.CurrentLayer + 1
		success := quotaTreasureRoll(nextLayer, position)
		multiplier := quotaTreasureMultipliers[nextLayer-1]
		step := QuotaTreasureStep{
			Layer:    nextLayer,
			Position: position,
			Outcome:  "failed",
		}
		if success {
			round.CurrentLayer = nextLayer
			round.CurrentMultiplier = multiplier
			step.Outcome = "success"
			step.Multiplier = multiplier
			step.PayoutAmount = calculateQuotaTreasurePayout(round.BetAmount, multiplier)
			if nextLayer == QuotaTreasureMaxLayer {
				round.Status = QuotaTreasureStatusSettled
				round.Result = QuotaTreasureResultCompleted
				round.PayoutAmount = step.PayoutAmount
				round.PayoutQuota = amountToQuota(step.PayoutAmount)
				round.SettledAt = common.GetTimestamp()
				user.Quota += round.PayoutQuota
				if err := tx.Save(&user).Error; err != nil {
					return err
				}
			}
		} else {
			round.Status = QuotaTreasureStatusFailed
			round.Result = QuotaTreasureResultFailed
			round.SettledAt = common.GetTimestamp()
		}

		steps = append(steps, step)
		stepsJSON, err := marshalQuotaTreasureSteps(steps)
		if err != nil {
			return err
		}
		round.Steps = stepsJSON
		if err := tx.Save(round).Error; err != nil {
			return err
		}

		view, err := quotaTreasureRoundToView(round)
		if err != nil {
			return err
		}
		view.UserQuota = user.Quota
		view.UserBalance = quotaToAmount(user.Quota)
		result = view
		return nil
	})
	if err != nil {
		return nil, err
	}

	if result.Status != QuotaTreasureStatusPlaying {
		_ = InvalidateUserCache(userId)
	}
	return result, nil
}

func CashoutQuotaTreasureRound(userId int, roundId int) (*QuotaTreasureRoundView, error) {
	var result *QuotaTreasureRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockQuotaTreasureRound(tx, userId, roundId)
		if err != nil {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if round.Status == QuotaTreasureStatusSettled {
			view, err := quotaTreasureRoundToView(round)
			if err != nil {
				return err
			}
			view.UserQuota = user.Quota
			view.UserBalance = quotaToAmount(user.Quota)
			result = view
			return nil
		}
		if round.Status == QuotaTreasureStatusFailed {
			return errors.New("探宝失败，无法带走奖励")
		}
		if round.CurrentLayer <= 0 {
			return errors.New("至少成功 1 层后才能带走奖励")
		}

		round.Status = QuotaTreasureStatusSettled
		round.Result = QuotaTreasureResultCashout
		round.PayoutAmount = calculateQuotaTreasurePayout(round.BetAmount, round.CurrentMultiplier)
		round.PayoutQuota = amountToQuota(round.PayoutAmount)
		round.SettledAt = common.GetTimestamp()
		user.Quota += round.PayoutQuota
		if err := tx.Save(round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		view, err := quotaTreasureRoundToView(round)
		if err != nil {
			return err
		}
		view.UserQuota = user.Quota
		view.UserBalance = quotaToAmount(user.Quota)
		result = view
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度探宝带走奖励 %.2f 站内余额", result.PayoutAmount))
	return result, nil
}

func lockQuotaTreasureRound(tx *gorm.DB, userId int, roundId int) (*GameTreasureRound, error) {
	var round GameTreasureRound
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ? AND user_id = ? AND game_key = ?", roundId, userId, GameKeyQuotaTreasure).
		First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("探宝记录不存在")
		}
		return nil, err
	}
	return &round, nil
}

func isQuotaTreasureBetAmountAllowed(amount int) bool {
	for _, allowed := range quotaTreasureBetAmounts {
		if amount == allowed {
			return true
		}
	}
	return false
}

func calculateQuotaTreasurePayout(betAmount int, multiplier float64) float64 {
	payout := math.Floor(float64(betAmount)*multiplier*100+0.000001) / 100
	if payout > float64(QuotaTreasureMaxPayoutAmount) {
		return float64(QuotaTreasureMaxPayoutAmount)
	}
	return payout
}

func quotaTreasureRoundToView(round *GameTreasureRound) (*QuotaTreasureRoundView, error) {
	steps, err := unmarshalQuotaTreasureSteps(round.Steps)
	if err != nil {
		return nil, err
	}
	view := &QuotaTreasureRoundView{
		Id:                  round.Id,
		Status:              round.Status,
		Result:              round.Result,
		BetAmount:           round.BetAmount,
		CurrentLayer:        round.CurrentLayer,
		CurrentMultiplier:   round.CurrentMultiplier,
		CurrentPayoutAmount: calculateQuotaTreasurePayout(round.BetAmount, round.CurrentMultiplier),
		Steps:               steps,
		PayoutQuota:         round.PayoutQuota,
		PayoutAmount:        round.PayoutAmount,
		CreatedAt:           round.CreatedAt,
		SettledAt:           round.SettledAt,
		CanPick:             round.Status == QuotaTreasureStatusPlaying && round.CurrentLayer < QuotaTreasureMaxLayer,
		CanCashout:          round.Status == QuotaTreasureStatusPlaying && round.CurrentLayer > 0,
	}
	return view, nil
}

func marshalQuotaTreasureSteps(steps []QuotaTreasureStep) (string, error) {
	data, err := common.Marshal(steps)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func unmarshalQuotaTreasureSteps(data string) ([]QuotaTreasureStep, error) {
	if data == "" {
		return []QuotaTreasureStep{}, nil
	}
	var steps []QuotaTreasureStep
	if err := common.UnmarshalJsonStr(data, &steps); err != nil {
		return nil, err
	}
	return steps, nil
}
