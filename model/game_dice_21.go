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
	GameKeyDice21 = "dice-21"

	Dice21StatusPlaying = "playing"
	Dice21StatusSettled = "settled"

	Dice21ResultWin  = "win"
	Dice21ResultLose = "lose"

	Dice21MaxPayoutAmount = 25
	Dice21Target          = 21
	Dice21DiceCount       = 4
)

var dice21BetAmounts = []int{1, 5, 10}

var dice21Rules = []string{
	"选择 1、5 或 10 站内余额入场，玩家和系统庄家各摇 4 颗骰子。",
	"目标是尽量接近 21 点且不能超过 21 点，超过 21 点视为爆点。",
	"玩家每局可免费重摇一次，重摇会替换全部 4 颗骰子。",
	"结算时玩家未爆点且点数高于庄家，或庄家爆点时获胜；同点数庄家胜。",
	"普通胜利按 1.6 倍派奖，刚好 21 点按 2.5 倍派奖，单局最高派奖 25 站内余额。",
}

type GameDice21Round struct {
	Id           int     `json:"id"`
	UserId       int     `json:"user_id" gorm:"index"`
	GameKey      string  `json:"game_key" gorm:"type:varchar(64);index"`
	Status       string  `json:"status" gorm:"type:varchar(32);index"`
	Result       string  `json:"result" gorm:"type:varchar(32)"`
	BetAmount    int     `json:"bet_amount" gorm:"default:0"`
	BetQuota     int     `json:"bet_quota" gorm:"default:0"`
	PlayerDice   string  `json:"-" gorm:"type:text"`
	DealerDice   string  `json:"-" gorm:"type:text"`
	PlayerTotal  int     `json:"player_total" gorm:"default:0"`
	DealerTotal  int     `json:"dealer_total" gorm:"default:0"`
	Rerolled     bool    `json:"rerolled" gorm:"default:false"`
	PayoutQuota  int     `json:"payout_quota" gorm:"default:0"`
	PayoutAmount float64 `json:"payout_amount" gorm:"default:0"`
	CreatedAt    int64   `json:"created_at" gorm:"bigint;autoCreateTime;index"`
	SettledAt    int64   `json:"settled_at" gorm:"bigint;index"`
}

type Dice21RoundView struct {
	Id           int     `json:"id"`
	Status       string  `json:"status"`
	Result       string  `json:"result,omitempty"`
	BetAmount    int     `json:"bet_amount"`
	PlayerDice   []int   `json:"player_dice"`
	DealerDice   []int   `json:"dealer_dice,omitempty"`
	PlayerTotal  int     `json:"player_total"`
	DealerTotal  int     `json:"dealer_total,omitempty"`
	Rerolled     bool    `json:"rerolled"`
	PayoutQuota  int     `json:"payout_quota"`
	PayoutAmount float64 `json:"payout_amount"`
	CreatedAt    int64   `json:"created_at"`
	SettledAt    int64   `json:"settled_at,omitempty"`
	UserQuota    int     `json:"user_quota,omitempty"`
	UserBalance  float64 `json:"user_balance,omitempty"`
	CanReroll    bool    `json:"can_reroll"`
	CanSettle    bool    `json:"can_settle"`
}

type Dice21Status struct {
	Enabled      bool               `json:"enabled"`
	GameKey      string             `json:"game_key"`
	Title        string             `json:"title"`
	BetAmounts   []int              `json:"bet_amounts"`
	UserQuota    int                `json:"user_quota"`
	UserBalance  float64            `json:"user_balance"`
	CurrentRound *Dice21RoundView   `json:"current_round,omitempty"`
	RecentRounds []Dice21RoundView  `json:"recent_rounds"`
	Rules        []string           `json:"rules"`
	MaxPayout    int                `json:"max_payout"`
	Multipliers  map[string]float64 `json:"multipliers"`
	DailyLimit   GameDailyLimitView `json:"daily_limit"`
}

func IsDice21Enabled() bool {
	return IsGamesEnabled() && common.GetEnvOrDefaultBool("GAME_FOUR_ENABLED", true)
}

func GetDice21Status(userId int) (*Dice21Status, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}

	var current GameDice21Round
	var currentView *Dice21RoundView
	err = DB.Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyDice21, Dice21StatusPlaying).
		Order("id desc").
		First(&current).Error
	if err == nil {
		view, err := dice21RoundToView(&current, false)
		if err != nil {
			return nil, err
		}
		view.UserQuota = userQuota
		view.UserBalance = quotaToAmount(userQuota)
		currentView = view
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var rounds []GameDice21Round
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyDice21).
		Order("id desc").
		Limit(20).
		Find(&rounds).Error; err != nil {
		return nil, err
	}

	recent := make([]Dice21RoundView, 0, len(rounds))
	for _, round := range rounds {
		view, err := dice21RoundToView(&round, round.Status == Dice21StatusSettled)
		if err != nil {
			return nil, err
		}
		recent = append(recent, *view)
	}
	dailyLimit, err := GetGameDailyLimit(userId)
	if err != nil {
		return nil, err
	}

	return &Dice21Status{
		Enabled:      IsDice21Enabled(),
		GameKey:      GameKeyDice21,
		Title:        "骰盅21",
		BetAmounts:   dice21BetAmounts,
		UserQuota:    userQuota,
		UserBalance:  quotaToAmount(userQuota),
		CurrentRound: currentView,
		RecentRounds: recent,
		Rules:        dice21Rules,
		MaxPayout:    Dice21MaxPayoutAmount,
		Multipliers:  map[string]float64{"normal": 1.6, "exact_21": 2.5},
		DailyLimit:   dailyLimit,
	}, nil
}

func CreateDice21Round(userId int, betAmount int) (*Dice21RoundView, error) {
	if !isDice21BetAmountAllowed(betAmount) {
		return nil, errors.New("入场额无效")
	}

	var result *Dice21RoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing GameDice21Round
		err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyDice21, Dice21StatusPlaying).
			First(&existing).Error
		if err == nil {
			return errors.New("已有未结算的骰盅21牌局，请先完成当前牌局")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		dailyState, err := ensureGameDailyPlayAvailable(tx, userId)
		if err != nil {
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

		playerDice := rollDice21Dice()
		dealerDice := rollDice21Dice()
		playerJSON, err := marshalDice21Dice(playerDice)
		if err != nil {
			return err
		}
		dealerJSON, err := marshalDice21Dice(dealerDice)
		if err != nil {
			return err
		}

		round := GameDice21Round{
			UserId:      userId,
			GameKey:     GameKeyDice21,
			Status:      Dice21StatusPlaying,
			BetAmount:   betAmount,
			BetQuota:    betQuota,
			PlayerDice:  playerJSON,
			DealerDice:  dealerJSON,
			PlayerTotal: sumDice21Dice(playerDice),
			DealerTotal: sumDice21Dice(dealerDice),
		}
		if err := tx.Create(&round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		recordGameDailyPlay(dailyState, -betQuota)
		if err := tx.Save(dailyState).Error; err != nil {
			return err
		}

		view, err := dice21RoundToView(&round, false)
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
	RecordLog(userId, LogTypeGame, fmt.Sprintf("骰盅21入场 %d 站内余额", betAmount))
	return result, nil
}

func RerollDice21Round(userId int, roundId int) (*Dice21RoundView, error) {
	var result *Dice21RoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockDice21Round(tx, userId, roundId)
		if err != nil {
			return err
		}
		if round.Status != Dice21StatusPlaying {
			return errors.New("本局骰盅21已结算")
		}
		if round.Rerolled {
			return errors.New("本局已经重摇过")
		}

		playerDice := rollDice21Dice()
		playerJSON, err := marshalDice21Dice(playerDice)
		if err != nil {
			return err
		}
		round.PlayerDice = playerJSON
		round.PlayerTotal = sumDice21Dice(playerDice)
		round.Rerolled = true
		if err := tx.Save(round).Error; err != nil {
			return err
		}

		view, err := dice21RoundToView(round, false)
		if err != nil {
			return err
		}
		result = view
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func SettleDice21Round(userId int, roundId int) (*Dice21RoundView, error) {
	var result *Dice21RoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockDice21Round(tx, userId, roundId)
		if err != nil {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if round.Status == Dice21StatusSettled {
			view, err := dice21RoundToView(round, true)
			if err != nil {
				return err
			}
			view.UserQuota = user.Quota
			view.UserBalance = quotaToAmount(user.Quota)
			result = view
			return nil
		}

		playerDice, err := unmarshalDice21Dice(round.PlayerDice)
		if err != nil {
			return err
		}
		dealerDice, err := unmarshalDice21Dice(round.DealerDice)
		if err != nil {
			return err
		}
		playerTotal := sumDice21Dice(playerDice)
		dealerTotal := sumDice21Dice(dealerDice)
		win := dice21PlayerWins(playerTotal, dealerTotal)
		payoutAmount := 0.0
		payoutQuota := 0
		resultText := Dice21ResultLose
		if win {
			payoutAmount = calculateDice21Payout(round.BetAmount, playerTotal)
			payoutQuota = amountToQuota(payoutAmount)
			user.Quota += payoutQuota
			resultText = Dice21ResultWin
		}

		round.Status = Dice21StatusSettled
		round.Result = resultText
		round.PlayerTotal = playerTotal
		round.DealerTotal = dealerTotal
		round.PayoutAmount = payoutAmount
		round.PayoutQuota = payoutQuota
		round.SettledAt = common.GetTimestamp()
		if err := tx.Save(round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if payoutQuota > 0 {
			if err := recordGameDailyNetQuota(tx, userId, payoutQuota); err != nil {
				return err
			}
		}

		view, err := dice21RoundToView(round, true)
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
	RecordLog(userId, LogTypeGame, fmt.Sprintf("骰盅21结算，结果：%s，派奖 %.2f 站内余额", result.Result, result.PayoutAmount))
	return result, nil
}

func lockDice21Round(tx *gorm.DB, userId int, roundId int) (*GameDice21Round, error) {
	var round GameDice21Round
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ? AND user_id = ? AND game_key = ?", roundId, userId, GameKeyDice21).
		First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("骰盅21记录不存在")
		}
		return nil, err
	}
	return &round, nil
}

func isDice21BetAmountAllowed(amount int) bool {
	for _, allowed := range dice21BetAmounts {
		if amount == allowed {
			return true
		}
	}
	return false
}

func rollDice21Dice() []int {
	dice := make([]int, Dice21DiceCount)
	for i := range dice {
		dice[i] = rand.Intn(6) + 1
	}
	return dice
}

func sumDice21Dice(dice []int) int {
	total := 0
	for _, value := range dice {
		total += value
	}
	return total
}

func dice21PlayerWins(playerTotal int, dealerTotal int) bool {
	if playerTotal > Dice21Target {
		return false
	}
	if dealerTotal > Dice21Target {
		return true
	}
	return playerTotal > dealerTotal
}

func calculateDice21Payout(betAmount int, total int) float64 {
	multiplier := 1.6
	if total == Dice21Target {
		multiplier = 2.5
	}
	payout := math.Floor(float64(betAmount)*multiplier*100+0.000001) / 100
	if payout > float64(Dice21MaxPayoutAmount) {
		return float64(Dice21MaxPayoutAmount)
	}
	return payout
}

func dice21RoundToView(round *GameDice21Round, revealDealer bool) (*Dice21RoundView, error) {
	playerDice, err := unmarshalDice21Dice(round.PlayerDice)
	if err != nil {
		return nil, err
	}
	view := &Dice21RoundView{
		Id:           round.Id,
		Status:       round.Status,
		Result:       round.Result,
		BetAmount:    round.BetAmount,
		PlayerDice:   playerDice,
		PlayerTotal:  sumDice21Dice(playerDice),
		Rerolled:     round.Rerolled,
		PayoutQuota:  round.PayoutQuota,
		PayoutAmount: round.PayoutAmount,
		CreatedAt:    round.CreatedAt,
		SettledAt:    round.SettledAt,
		CanReroll:    round.Status == Dice21StatusPlaying && !round.Rerolled,
		CanSettle:    round.Status == Dice21StatusPlaying,
	}
	if revealDealer {
		dealerDice, err := unmarshalDice21Dice(round.DealerDice)
		if err != nil {
			return nil, err
		}
		view.DealerDice = dealerDice
		view.DealerTotal = sumDice21Dice(dealerDice)
	}
	return view, nil
}

func marshalDice21Dice(dice []int) (string, error) {
	data, err := common.Marshal(dice)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func unmarshalDice21Dice(data string) ([]int, error) {
	if data == "" {
		return []int{}, nil
	}
	var dice []int
	if err := common.UnmarshalJsonStr(data, &dice); err != nil {
		return nil, err
	}
	return dice, nil
}
