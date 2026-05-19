package model

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const (
	GameKeyMagicCube = "magic-cube"

	GameRewardTypeBalance            = "balance"
	GameRewardTypeCube               = "cube"
	GameRewardTypeRegisterFrag       = "register_fragment"
	GameRewardTypeConsumeFrag        = "consume_fragment"
	GameRewardTypeRegisterCode       = "register_code"
	GameRewardTypeConsumeCode        = "consume_code"
	GameRewardTypeTicket             = "ticket"
	GameRewardTypeQuota              = "quota"
	GameRewardTypeCoupon             = "coupon"
	GameExchangeCostTypeCube         = "cube"
	GameExchangeCostTypeRegFrag      = "register_fragment"
	GameExchangeCostTypeConFrag      = "consume_fragment"
	MagicCubePityCount               = 100
	MagicCubeCostAmountPerDraw       = 1
	MagicCubeRegisterFragRequired    = 300
	MagicCubeConsumeFragRequired     = 150
	MagicCubeConsumeBalanceAmount    = 20
	MagicCubeConsumeCodeAmount       = 30
	MagicCubeCycleSeconds            = 7 * 24 * 60 * 60
	MagicCubeRedemptionExpireSeconds = 72 * 60 * 60
)

type GameUserStat struct {
	Id                    int    `json:"id"`
	UserId                int    `json:"user_id" gorm:"index;uniqueIndex:idx_game_user_stat_user_game"`
	GameKey               string `json:"game_key" gorm:"type:varchar(64);index;uniqueIndex:idx_game_user_stat_user_game"`
	TotalDraws            int    `json:"total_draws" gorm:"default:0"`
	PityProgress          int    `json:"pity_progress" gorm:"default:0"`
	CubeCount             int    `json:"cube_count" gorm:"default:0"`
	TicketCount           int    `json:"ticket_count" gorm:"default:0"`
	RegisterCodeFragments int    `json:"register_code_fragments" gorm:"default:0"`
	ConsumeCodeFragments  int    `json:"consume_code_fragments" gorm:"default:0"`
	CycleStartAt          int64  `json:"cycle_start_at" gorm:"bigint;default:0"`
	CycleEndAt            int64  `json:"cycle_end_at" gorm:"bigint;default:0"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt             int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type GameDrawLog struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index"`
	GameKey      string `json:"game_key" gorm:"type:varchar(64);index"`
	DrawNo       int    `json:"draw_no" gorm:"default:0"`
	RewardType   string `json:"reward_type" gorm:"type:varchar(32);index"`
	RewardName   string `json:"reward_name" gorm:"type:varchar(128)"`
	RewardAmount int    `json:"reward_amount" gorm:"default:0"`
	IsPity       bool   `json:"is_pity" gorm:"default:false"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;autoCreateTime;index"`
}

type GameMilestoneClaim struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id" gorm:"index;uniqueIndex:idx_game_milestone_user_game_draws"`
	GameKey        string `json:"game_key" gorm:"type:varchar(64);index;uniqueIndex:idx_game_milestone_user_game_draws"`
	MilestoneDraws int    `json:"milestone_draws" gorm:"uniqueIndex:idx_game_milestone_user_game_draws"`
	RewardType     string `json:"reward_type" gorm:"type:varchar(32)"`
	RewardName     string `json:"reward_name" gorm:"type:varchar(128)"`
	RewardAmount   int    `json:"reward_amount" gorm:"default:0"`
	ClaimedAt      int64  `json:"claimed_at" gorm:"bigint;index"`
}

type GameExchangeLog struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index"`
	GameKey      string `json:"game_key" gorm:"type:varchar(64);index"`
	ItemId       int    `json:"item_id" gorm:"index"`
	ItemName     string `json:"item_name" gorm:"type:varchar(128)"`
	CubeCost     int    `json:"cube_cost" gorm:"default:0"`
	RewardType   string `json:"reward_type" gorm:"type:varchar(32)"`
	RewardName   string `json:"reward_name" gorm:"type:varchar(128)"`
	RewardAmount int    `json:"reward_amount" gorm:"default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;autoCreateTime;index"`
}

type MagicCubeRewardConfig struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Amount int    `json:"amount"`
}

type MagicCubeMilestoneConfig struct {
	Draws  int                   `json:"draws"`
	Reward MagicCubeRewardConfig `json:"reward"`
}

type MagicCubeExchangeItemConfig struct {
	Id          int                   `json:"id"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	CostType    string                `json:"cost_type"`
	CostAmount  int                   `json:"cost_amount"`
	CubeCost    int                   `json:"cube_cost"`
	Reward      MagicCubeRewardConfig `json:"reward"`
}

type MagicCubeStatus struct {
	Enabled               bool                          `json:"enabled"`
	GameKey               string                        `json:"game_key"`
	Title                 string                        `json:"title"`
	PityCount             int                           `json:"pity_count"`
	CostPerDraw           int                           `json:"cost_per_draw"`
	CostAmountPerDraw     int                           `json:"cost_amount_per_draw"`
	TotalDraws            int                           `json:"total_draws"`
	PityProgress          int                           `json:"pity_progress"`
	CubeCount             int                           `json:"cube_count"`
	TicketCount           int                           `json:"ticket_count"`
	RegisterCodeFragments int                           `json:"register_code_fragments"`
	ConsumeCodeFragments  int                           `json:"consume_code_fragments"`
	UserQuota             int                           `json:"user_quota"`
	UserBalance           float64                       `json:"user_balance"`
	CycleStartAt          int64                         `json:"cycle_start_at"`
	CycleEndAt            int64                         `json:"cycle_end_at"`
	CycleRemainingSeconds int64                         `json:"cycle_remaining_seconds"`
	Milestones            []MagicCubeMilestoneView      `json:"milestones"`
	ExchangeItems         []MagicCubeExchangeItemConfig `json:"exchange_items"`
	RecentLogs            []GameDrawLog                 `json:"recent_logs"`
	Rules                 []string                      `json:"rules"`
}

type MagicCubeMilestoneView struct {
	Draws     int                   `json:"draws"`
	Reward    MagicCubeRewardConfig `json:"reward"`
	Status    string                `json:"status"`
	ClaimedAt int64                 `json:"claimed_at,omitempty"`
}

type MagicCubeDrawResult struct {
	Rewards                []GameDrawLog `json:"rewards"`
	TotalDraws             int           `json:"total_draws"`
	PityProgress           int           `json:"pity_progress"`
	CubeCount              int           `json:"cube_count"`
	TicketCount            int           `json:"ticket_count"`
	RegisterCodeFragments  int           `json:"register_code_fragments"`
	ConsumeCodeFragments   int           `json:"consume_code_fragments"`
	UserQuota              int           `json:"user_quota"`
	UserBalance            float64       `json:"user_balance"`
	NewClaimableMilestones []int         `json:"new_claimable_milestones"`
}

type MagicCubeClaimResult struct {
	Milestone              MagicCubeMilestoneView `json:"milestone"`
	CubeCount              int                    `json:"cube_count"`
	TicketCount            int                    `json:"ticket_count"`
	RegisterCodeFragments  int                    `json:"register_code_fragments"`
	ConsumeCodeFragments   int                    `json:"consume_code_fragments"`
	UserQuota              int                    `json:"user_quota"`
	UserBalance            float64                `json:"user_balance"`
	CreatedCode            string                 `json:"created_code,omitempty"`
	CreatedCodeExpiredTime int64                  `json:"created_code_expired_time,omitempty"`
}

type MagicCubeExchangeResult struct {
	Item                   MagicCubeExchangeItemConfig `json:"item"`
	CubeCount              int                         `json:"cube_count"`
	TicketCount            int                         `json:"ticket_count"`
	RegisterCodeFragments  int                         `json:"register_code_fragments"`
	ConsumeCodeFragments   int                         `json:"consume_code_fragments"`
	UserQuota              int                         `json:"user_quota"`
	UserBalance            float64                     `json:"user_balance"`
	CreatedCode            string                      `json:"created_code,omitempty"`
	CreatedCodeExpiredTime int64                       `json:"created_code_expired_time,omitempty"`
}

type MagicCubeExchangeRecord struct {
	Id          int     `json:"id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Code        string  `json:"code"`
	Quota       int     `json:"quota"`
	Balance     float64 `json:"balance"`
	CreatedTime int64   `json:"created_time"`
	ExpiredTime int64   `json:"expired_time"`
	Status      int     `json:"status"`
}

var magicCubeMilestones = []MagicCubeMilestoneConfig{
	{Draws: 20, Reward: MagicCubeRewardConfig{Type: GameRewardTypeRegisterFrag, Name: "注册码碎片 x5", Amount: 5}},
	{Draws: 40, Reward: MagicCubeRewardConfig{Type: GameRewardTypeConsumeFrag, Name: "消费码碎片 x5", Amount: 5}},
	{Draws: 60, Reward: MagicCubeRewardConfig{Type: GameRewardTypeBalance, Name: "站内余额 5.00", Amount: amountToQuota(5)}},
	{Draws: 80, Reward: MagicCubeRewardConfig{Type: GameRewardTypeRegisterFrag, Name: "注册码碎片 x10", Amount: 10}},
	{Draws: 100, Reward: MagicCubeRewardConfig{Type: GameRewardTypeBalance, Name: "站内余额 10.00", Amount: amountToQuota(10)}},
}

var magicCubeExchangeItems = []MagicCubeExchangeItemConfig{
	{
		Id:          1,
		Name:        "注册码碎片兑换注册码",
		Description: "消耗 300 个注册码碎片，兑换 1 个新的注册码。",
		CostType:    GameExchangeCostTypeRegFrag,
		CostAmount:  MagicCubeRegisterFragRequired,
		Reward:      MagicCubeRewardConfig{Type: GameRewardTypeRegisterCode, Name: "新注册码 x1", Amount: 1},
	},
	{
		Id:          2,
		Name:        "消费码碎片兑换余额",
		Description: "消耗 150 个消费码碎片，兑换 20 站内余额。",
		CostType:    GameExchangeCostTypeConFrag,
		CostAmount:  MagicCubeConsumeFragRequired,
		Reward:      MagicCubeRewardConfig{Type: GameRewardTypeBalance, Name: "站内余额 20.00", Amount: amountToQuota(MagicCubeConsumeBalanceAmount)},
	},
	{
		Id:          3,
		Name:        "幸运魔方兑换注册码",
		Description: "消耗 2 个幸运魔方，兑换 1 个新的注册码。",
		CostType:    GameExchangeCostTypeCube,
		CostAmount:  2,
		CubeCost:    2,
		Reward:      MagicCubeRewardConfig{Type: GameRewardTypeRegisterCode, Name: "新注册码 x1", Amount: 1},
	},
	{
		Id:          4,
		Name:        "幸运魔方兑换消费码",
		Description: "消耗 1 个幸运魔方，兑换 1 个可充值 30 站内余额的消费码。",
		CostType:    GameExchangeCostTypeCube,
		CostAmount:  1,
		CubeCost:    1,
		Reward:      MagicCubeRewardConfig{Type: GameRewardTypeConsumeCode, Name: "消费码 30余额 x1", Amount: 1},
	},
}

var magicCubeRules = []string{
	"每次抽奖消耗 1 站内金额。",
	"抽奖有机会获得幸运魔方、注册码碎片、消费码碎片和随机站内余额。",
	"每累计 100 次抽奖必得幸运魔方，随机提前抽中幸运魔方会重置保底进度。",
	"当前周期每 10 次可领取一次阶段奖励。",
	"抽奖周期为 7 天，到期后累计抽奖和阶段奖励领取状态重置。",
	"幸运魔方、注册码碎片、消费码碎片不会因周期重置而清空。",
	"300 个注册码碎片可兑换 1 个新的注册码。",
	"150 个消费码碎片可兑换 20 站内余额。",
	"2 个幸运魔方可兑换 1 个新的注册码，1 个幸运魔方可兑换 30 站内余额消费码。",
	"当前周期累计抽奖 100 次的阶段奖励为 10 站内余额。",
	"活动奖励以实际到账为准，如发现异常行为，平台有权取消相关奖励。",
}

func IsMagicCubeEnabled() bool {
	return IsGamesEnabled() && IsMagicCubeGameEnabled()
}

func IsGamesEnabled() bool {
	return common.GetEnvOrDefaultBool("GAMES_ENABLED", true)
}

func IsMagicCubeGameEnabled() bool {
	return common.GetEnvOrDefaultBool("GAME_ONE_ENABLED", true)
}

func GetMagicCubeMilestones() []MagicCubeMilestoneConfig {
	return magicCubeMilestones
}

func GetMagicCubeExchangeItems() []MagicCubeExchangeItemConfig {
	return magicCubeExchangeItems
}

func getOrCreateGameUserStat(tx *gorm.DB, userId int, gameKey string) (*GameUserStat, error) {
	var stat GameUserStat
	err := tx.Where("user_id = ? AND game_key = ?", userId, gameKey).First(&stat).Error
	if err == nil {
		if err := ensureMagicCubeCycle(tx, &stat); err != nil {
			return nil, err
		}
		return &stat, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := common.GetTimestamp()
	stat = GameUserStat{
		UserId:       userId,
		GameKey:      gameKey,
		CycleStartAt: now,
		CycleEndAt:   now + MagicCubeCycleSeconds,
	}
	if err := tx.Create(&stat).Error; err != nil {
		return nil, err
	}
	return &stat, nil
}

func ensureMagicCubeCycle(tx *gorm.DB, stat *GameUserStat) error {
	now := common.GetTimestamp()
	if stat.CycleStartAt <= 0 || stat.CycleEndAt <= 0 {
		stat.CycleStartAt = now
		stat.CycleEndAt = now + MagicCubeCycleSeconds
		return tx.Save(stat).Error
	}
	if now < stat.CycleEndAt {
		return nil
	}

	stat.TotalDraws = 0
	stat.CycleStartAt = now
	stat.CycleEndAt = now + MagicCubeCycleSeconds

	if err := tx.Where("user_id = ? AND game_key = ?", stat.UserId, stat.GameKey).
		Delete(&GameMilestoneClaim{}).Error; err != nil {
		return err
	}

	return tx.Save(stat).Error
}

func GetMagicCubeStatus(userId int) (*MagicCubeStatus, error) {
	var stat *GameUserStat
	err := DB.Transaction(func(tx *gorm.DB) error {
		var txErr error
		stat, txErr = getOrCreateGameUserStat(tx, userId, GameKeyMagicCube)
		return txErr
	})
	if err != nil {
		return nil, err
	}

	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}

	var claims []GameMilestoneClaim
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyMagicCube).Find(&claims).Error; err != nil {
		return nil, err
	}
	claimMap := make(map[int]GameMilestoneClaim, len(claims))
	for _, claim := range claims {
		claimMap[claim.MilestoneDraws] = claim
	}

	milestones := make([]MagicCubeMilestoneView, 0, len(magicCubeMilestones))
	for _, item := range magicCubeMilestones {
		status := "locked"
		claimedAt := int64(0)
		if claim, ok := claimMap[item.Draws]; ok {
			status = "claimed"
			claimedAt = claim.ClaimedAt
		} else if stat.TotalDraws >= item.Draws {
			status = "claimable"
		}
		milestones = append(milestones, MagicCubeMilestoneView{
			Draws:     item.Draws,
			Reward:    item.Reward,
			Status:    status,
			ClaimedAt: claimedAt,
		})
	}

	var recentLogs []GameDrawLog
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyMagicCube).
		Order("id desc").
		Limit(20).
		Find(&recentLogs).Error; err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	remainingSeconds := stat.CycleEndAt - now
	if remainingSeconds < 0 {
		remainingSeconds = 0
	}

	return &MagicCubeStatus{
		Enabled:               IsMagicCubeEnabled(),
		GameKey:               GameKeyMagicCube,
		Title:                 "幸运魔方补给站",
		PityCount:             MagicCubePityCount,
		CostPerDraw:           magicCubeDrawCostQuota(),
		CostAmountPerDraw:     MagicCubeCostAmountPerDraw,
		TotalDraws:            stat.TotalDraws,
		PityProgress:          stat.PityProgress,
		CubeCount:             stat.CubeCount,
		TicketCount:           stat.TicketCount,
		RegisterCodeFragments: stat.RegisterCodeFragments,
		ConsumeCodeFragments:  stat.ConsumeCodeFragments,
		UserQuota:             userQuota,
		UserBalance:           quotaToAmount(userQuota),
		CycleStartAt:          stat.CycleStartAt,
		CycleEndAt:            stat.CycleEndAt,
		CycleRemainingSeconds: remainingSeconds,
		Milestones:            milestones,
		ExchangeItems:         magicCubeExchangeItems,
		RecentLogs:            recentLogs,
		Rules:                 magicCubeRules,
	}, nil
}

func DrawMagicCube(userId int, count int) (*MagicCubeDrawResult, error) {
	if count != 1 && count != 5 && count != 10 && count != 50 {
		return nil, errors.New("只支持抽 1 次、5 次、10 次或 50 次")
	}

	var result MagicCubeDrawResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		stat, err := getOrCreateGameUserStat(tx, userId, GameKeyMagicCube)
		if err != nil {
			return err
		}

		drawCostQuota := magicCubeDrawCostQuota() * count
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userId).
			First(&user).Error; err != nil {
			return err
		}
		if user.Quota < drawCostQuota {
			return errors.New("站内余额不足")
		}
		user.Quota -= drawCostQuota

		rewards := make([]GameDrawLog, 0, count)
		for i := 0; i < count; i++ {
			stat.TotalDraws++
			if stat.PityProgress < MagicCubePityCount {
				stat.PityProgress++
			}

			reward := rollMagicCubeReward()
			isPity := false
			if stat.PityProgress >= MagicCubePityCount {
				reward = MagicCubeRewardConfig{Type: GameRewardTypeCube, Name: "幸运魔方 x1", Amount: 1}
				isPity = true
				stat.PityProgress = 0
			} else if reward.Type == GameRewardTypeCube {
				stat.PityProgress = 0
			}

			if _, _, err := applyMagicCubeReward(tx, stat, &user, reward); err != nil {
				return err
			}

			logItem := GameDrawLog{
				UserId:       userId,
				GameKey:      GameKeyMagicCube,
				DrawNo:       stat.TotalDraws,
				RewardType:   reward.Type,
				RewardName:   reward.Name,
				RewardAmount: reward.Amount,
				IsPity:       isPity,
			}
			if err := tx.Create(&logItem).Error; err != nil {
				return err
			}
			rewards = append(rewards, logItem)
		}

		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if err := tx.Save(stat).Error; err != nil {
			return err
		}

		result.Rewards = rewards
		result.TotalDraws = stat.TotalDraws
		result.PityProgress = stat.PityProgress
		result.CubeCount = stat.CubeCount
		result.TicketCount = stat.TicketCount
		result.RegisterCodeFragments = stat.RegisterCodeFragments
		result.ConsumeCodeFragments = stat.ConsumeCodeFragments
		result.UserQuota = user.Quota
		result.UserBalance = quotaToAmount(user.Quota)
		result.NewClaimableMilestones = getClaimableMilestoneDraws(tx, userId, stat.TotalDraws)
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("幸运魔方补给站抽奖 %d 次", count))
	return &result, nil
}

func ClaimMagicCubeMilestone(userId int, milestoneDraws int) (*MagicCubeClaimResult, error) {
	var result MagicCubeClaimResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		stat, err := getOrCreateGameUserStat(tx, userId, GameKeyMagicCube)
		if err != nil {
			return err
		}
		if stat.TotalDraws < milestoneDraws {
			return errors.New("尚未达到该阶段奖励领取条件")
		}

		var milestone *MagicCubeMilestoneConfig
		for _, item := range magicCubeMilestones {
			if item.Draws == milestoneDraws {
				copied := item
				milestone = &copied
				break
			}
		}
		if milestone == nil {
			return errors.New("阶段奖励不存在")
		}

		var existing GameMilestoneClaim
		err = tx.Where("user_id = ? AND game_key = ? AND milestone_draws = ?", userId, GameKeyMagicCube, milestoneDraws).First(&existing).Error
		if err == nil {
			return errors.New("该阶段奖励已领取")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userId).
			First(&user).Error; err != nil {
			return err
		}
		createdCode, createdCodeExpiredTime, err := applyMagicCubeReward(tx, stat, &user, milestone.Reward)
		if err != nil {
			return err
		}

		now := time.Now().Unix()
		claim := GameMilestoneClaim{
			UserId:         userId,
			GameKey:        GameKeyMagicCube,
			MilestoneDraws: milestone.Draws,
			RewardType:     milestone.Reward.Type,
			RewardName:     milestone.Reward.Name,
			RewardAmount:   milestone.Reward.Amount,
			ClaimedAt:      now,
		}
		if err := tx.Create(&claim).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if err := tx.Save(stat).Error; err != nil {
			return err
		}

		result.Milestone = MagicCubeMilestoneView{
			Draws:     milestone.Draws,
			Reward:    milestone.Reward,
			Status:    "claimed",
			ClaimedAt: now,
		}
		result.CubeCount = stat.CubeCount
		result.TicketCount = stat.TicketCount
		result.RegisterCodeFragments = stat.RegisterCodeFragments
		result.ConsumeCodeFragments = stat.ConsumeCodeFragments
		result.UserQuota = user.Quota
		result.UserBalance = quotaToAmount(user.Quota)
		result.CreatedCode = createdCode
		result.CreatedCodeExpiredTime = createdCodeExpiredTime
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("领取幸运魔方补给站 %d 次阶段奖励", milestoneDraws))
	return &result, nil
}

func ExchangeMagicCubeItem(userId int, itemId int) (*MagicCubeExchangeResult, error) {
	var result MagicCubeExchangeResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		stat, err := getOrCreateGameUserStat(tx, userId, GameKeyMagicCube)
		if err != nil {
			return err
		}

		var item *MagicCubeExchangeItemConfig
		for _, candidate := range magicCubeExchangeItems {
			if candidate.Id == itemId {
				copied := candidate
				item = &copied
				break
			}
		}
		if item == nil {
			return errors.New("兑换商品不存在")
		}

		if err := consumeMagicCubeExchangeCost(stat, item); err != nil {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id = ?", userId).
			First(&user).Error; err != nil {
			return err
		}
		createdCode, createdCodeExpiredTime, err := applyMagicCubeReward(tx, stat, &user, item.Reward)
		if err != nil {
			return err
		}

		exchangeLog := GameExchangeLog{
			UserId:       userId,
			GameKey:      GameKeyMagicCube,
			ItemId:       item.Id,
			ItemName:     item.Name,
			CubeCost:     item.CubeCost,
			RewardType:   item.Reward.Type,
			RewardName:   item.Reward.Name,
			RewardAmount: item.Reward.Amount,
		}
		if err := tx.Create(&exchangeLog).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if err := tx.Save(stat).Error; err != nil {
			return err
		}

		result.Item = *item
		result.CubeCount = stat.CubeCount
		result.TicketCount = stat.TicketCount
		result.RegisterCodeFragments = stat.RegisterCodeFragments
		result.ConsumeCodeFragments = stat.ConsumeCodeFragments
		result.UserQuota = user.Quota
		result.UserBalance = quotaToAmount(user.Quota)
		result.CreatedCode = createdCode
		result.CreatedCodeExpiredTime = createdCodeExpiredTime
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("兑换幸运魔方补给站商品：%s", result.Item.Name))
	return &result, nil
}

func GetMagicCubeExchangeRecords(userId int) ([]MagicCubeExchangeRecord, error) {
	var redemptions []Redemption
	if err := DB.Where("user_id = ? AND name LIKE ?", userId, "幸运魔方补给站-%").
		Order("id desc").
		Limit(20).
		Find(&redemptions).Error; err != nil {
		return nil, err
	}

	records := make([]MagicCubeExchangeRecord, 0, len(redemptions))
	for _, redemption := range redemptions {
		records = append(records, MagicCubeExchangeRecord{
			Id:          redemption.Id,
			Name:        redemption.Name,
			Type:        redemption.Type,
			Code:        redemption.Key,
			Quota:       redemption.Quota,
			Balance:     quotaToAmount(redemption.Quota),
			CreatedTime: redemption.CreatedTime,
			ExpiredTime: redemption.ExpiredTime,
			Status:      redemption.Status,
		})
	}
	return records, nil
}

func rollMagicCubeReward() MagicCubeRewardConfig {
	// 0.1% 概率获得幸运魔方。该概率仅在后端保存，前端不展示。
	if rand.Intn(10000) < 10 {
		return MagicCubeRewardConfig{Type: GameRewardTypeCube, Name: "幸运魔方 x1", Amount: 1}
	}

	n := rand.Intn(10000)
	switch {
	case n < 4500:
		amount := 1 + rand.Intn(3)
		return MagicCubeRewardConfig{Type: GameRewardTypeRegisterFrag, Name: fmt.Sprintf("注册码碎片 x%d", amount), Amount: amount}
	case n < 9000:
		amount := 1 + rand.Intn(3)
		return MagicCubeRewardConfig{Type: GameRewardTypeConsumeFrag, Name: fmt.Sprintf("消费码碎片 x%d", amount), Amount: amount}
	default:
		rewardQuota, amount := randomMagicCubeBalanceReward()
		return MagicCubeRewardConfig{Type: GameRewardTypeBalance, Name: fmt.Sprintf("站内余额 %.2f", amount), Amount: rewardQuota}
	}
}

func applyMagicCubeReward(tx *gorm.DB, stat *GameUserStat, user *User, reward MagicCubeRewardConfig) (string, int64, error) {
	if reward.Amount <= 0 && reward.Type != GameRewardTypeBalance {
		return "", 0, nil
	}

	switch reward.Type {
	case GameRewardTypeBalance, GameRewardTypeQuota:
		user.Quota += resolveMagicCubeBalanceRewardQuota(reward)
	case GameRewardTypeRegisterFrag:
		stat.RegisterCodeFragments += reward.Amount
	case GameRewardTypeConsumeFrag:
		stat.ConsumeCodeFragments += reward.Amount
	case GameRewardTypeCube:
		stat.CubeCount += reward.Amount
	case GameRewardTypeRegisterCode:
		code, expiredTime, err := createMagicCubeRedemption(tx, user.Id, common.RedemptionTypeInvitation, 0, "幸运魔方补给站-注册码")
		if err != nil {
			return "", 0, err
		}
		return code, expiredTime, nil
	case GameRewardTypeConsumeCode:
		code, expiredTime, err := createMagicCubeRedemption(tx, user.Id, common.RedemptionTypeQuota, amountToQuota(MagicCubeConsumeCodeAmount), "幸运魔方补给站-消费码30余额")
		if err != nil {
			return "", 0, err
		}
		return code, expiredTime, nil
	case GameRewardTypeTicket, GameRewardTypeCoupon:
		return "", 0, nil
	default:
		return "", 0, fmt.Errorf("未知奖励类型：%s", reward.Type)
	}

	return "", 0, nil
}

func consumeMagicCubeExchangeCost(stat *GameUserStat, item *MagicCubeExchangeItemConfig) error {
	switch item.CostType {
	case GameExchangeCostTypeCube:
		if stat.CubeCount < item.CostAmount {
			return errors.New("幸运魔方不足")
		}
		stat.CubeCount -= item.CostAmount
	case GameExchangeCostTypeRegFrag:
		if stat.RegisterCodeFragments < item.CostAmount {
			return errors.New("注册码碎片不足")
		}
		stat.RegisterCodeFragments -= item.CostAmount
	case GameExchangeCostTypeConFrag:
		if stat.ConsumeCodeFragments < item.CostAmount {
			return errors.New("消费码碎片不足")
		}
		stat.ConsumeCodeFragments -= item.CostAmount
	default:
		return errors.New("兑换消耗类型无效")
	}
	return nil
}

func createMagicCubeRedemption(tx *gorm.DB, userId int, redemptionType string, quota int, name string) (string, int64, error) {
	for i := 0; i < 5; i++ {
		key := common.GetUUID()
		now := common.GetTimestamp()
		expiredTime := now + MagicCubeRedemptionExpireSeconds
		redemption := Redemption{
			UserId:      userId,
			Key:         key,
			Status:      common.RedemptionCodeStatusEnabled,
			Type:        redemptionType,
			Name:        name,
			Quota:       quota,
			CreatedTime: now,
			ExpiredTime: expiredTime,
		}
		if err := tx.Create(&redemption).Error; err != nil {
			continue
		}
		return key, expiredTime, nil
	}
	return "", 0, errors.New("生成兑换码失败")
}

func getClaimableMilestoneDraws(tx *gorm.DB, userId int, totalDraws int) []int {
	claimable := make([]int, 0)
	for _, milestone := range magicCubeMilestones {
		if totalDraws < milestone.Draws {
			continue
		}
		var count int64
		err := tx.Model(&GameMilestoneClaim{}).
			Where("user_id = ? AND game_key = ? AND milestone_draws = ?", userId, GameKeyMagicCube, milestone.Draws).
			Count(&count).Error
		if err == nil && count == 0 {
			claimable = append(claimable, milestone.Draws)
		}
	}
	return claimable
}

func magicCubeDrawCostQuota() int {
	return amountToQuota(MagicCubeCostAmountPerDraw)
}

func amountToQuota(amount float64) int {
	quota := int(common.QuotaPerUnit * amount)
	if quota <= 0 {
		return int(amount)
	}
	return quota
}

func quotaToAmount(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return float64(quota)
	}
	return float64(quota) / common.QuotaPerUnit
}

func resolveMagicCubeBalanceRewardQuota(reward MagicCubeRewardConfig) int {
	if reward.Amount > 0 {
		return reward.Amount
	}
	return amountToQuota(MagicCubeConsumeBalanceAmount)
}

func randomMagicCubeBalanceReward() (int, float64) {
	n := rand.Intn(100)
	var cents int
	switch {
	case n < 70:
		cents = 20 + rand.Intn(21)
	case n < 90:
		cents = 41 + rand.Intn(20)
	default:
		cents = 61 + rand.Intn(20)
	}
	amount := float64(cents) / 100
	return amountToQuota(amount), amount
}

func FormatMagicCubeReward(reward MagicCubeRewardConfig) string {
	if reward.Type == GameRewardTypeBalance || reward.Type == GameRewardTypeQuota {
		return logger.LogQuota(reward.Amount)
	}
	return reward.Name
}
