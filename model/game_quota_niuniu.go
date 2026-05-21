package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	GameKeyQuotaNiuniu = "quota-niuniu"

	QuotaNiuniuStatusPlaying = "playing"
	QuotaNiuniuStatusSettled = "settled"

	QuotaNiuniuResultWin  = "win"
	QuotaNiuniuResultLose = "lose"
	QuotaNiuniuResultPush = "push"

	QuotaNiuniuModeBanker = "banker"
	QuotaNiuniuModeGrab   = "grab"

	QuotaNiuniuMaxPayoutAmount = 50
	QuotaNiuniuUserSeat        = 0
)

var quotaNiuniuBetAmounts = []int{1, 5, 10}
var quotaNiuniuTableSizes = []int{3, 5}

var quotaNiuniuRules = []string{
	"选择 1、5 或 10 站内余额入场，可选择 3 人桌或 5 人桌。",
	"庄家模式由玩家固定坐庄，抢庄模式由系统为每个座位模拟抢庄并选出庄家。",
	"系统会补齐其他座位并发放 5 张牌，按斗牛牌型与庄家结算。",
	"倍率：无牛 0、牛1-6 1.6、牛7-9 1.8、牛牛 2.5、四花/五花 3、炸弹 4、五小牛 5。",
	"输牌按赢家牌型倍率计算，入场额已预扣，结算时只补扣差额。",
	"单局最高派奖 50 站内余额，余额不足时扣至 0，结算后重复请求不会重复派奖。",
}

type GameQuotaNiuniuRound struct {
	Id           int     `json:"id"`
	UserId       int     `json:"user_id" gorm:"index"`
	GameKey      string  `json:"game_key" gorm:"type:varchar(64);index"`
	Status       string  `json:"status" gorm:"type:varchar(32);index"`
	Result       string  `json:"result" gorm:"type:varchar(32)"`
	BetAmount    int     `json:"bet_amount" gorm:"default:0"`
	BetQuota     int     `json:"bet_quota" gorm:"default:0"`
	TableSize    int     `json:"table_size" gorm:"default:0"`
	Mode         string  `json:"mode" gorm:"type:varchar(32)"`
	BankerSeat   int     `json:"banker_seat" gorm:"default:0"`
	Seats        string  `json:"-" gorm:"type:text"`
	PayoutQuota  int     `json:"payout_quota" gorm:"default:0"`
	PayoutAmount float64 `json:"payout_amount" gorm:"default:0"`
	CreatedAt    int64   `json:"created_at" gorm:"bigint;autoCreateTime;index"`
	SettledAt    int64   `json:"settled_at" gorm:"bigint;index"`
}

type QuotaNiuniuCard struct {
	Suit string `json:"suit"`
	Rank int    `json:"rank"`
}

type QuotaNiuniuHand struct {
	Type        string  `json:"type"`
	TypeLabel   string  `json:"type_label"`
	Multiplier  float64 `json:"multiplier"`
	RankScore   int     `json:"rank_score"`
	NiuPoint    int     `json:"niu_point"`
	TieBreakers []int   `json:"tie_breakers"`
}

type QuotaNiuniuSeat struct {
	Seat      int               `json:"seat"`
	IsUser    bool              `json:"is_user"`
	IsBanker  bool              `json:"is_banker"`
	GrabScore int               `json:"grab_score"`
	Cards     []QuotaNiuniuCard `json:"cards,omitempty"`
	Hand      *QuotaNiuniuHand  `json:"hand,omitempty"`
	Result    string            `json:"result,omitempty"`
}

type quotaNiuniuSeatState struct {
	Seat      int               `json:"seat"`
	IsUser    bool              `json:"is_user"`
	GrabScore int               `json:"grab_score"`
	Cards     []QuotaNiuniuCard `json:"cards"`
}

type quotaNiuniuSettlement struct {
	Result string
	Amount float64
}

type QuotaNiuniuRoundView struct {
	Id           int               `json:"id"`
	Status       string            `json:"status"`
	Result       string            `json:"result,omitempty"`
	BetAmount    int               `json:"bet_amount"`
	TableSize    int               `json:"table_size"`
	Mode         string            `json:"mode"`
	BankerSeat   int               `json:"banker_seat"`
	Seats        []QuotaNiuniuSeat `json:"seats"`
	PayoutQuota  int               `json:"payout_quota"`
	PayoutAmount float64           `json:"payout_amount"`
	NetProfit    float64           `json:"net_profit"`
	CreatedAt    int64             `json:"created_at"`
	SettledAt    int64             `json:"settled_at,omitempty"`
	UserQuota    int               `json:"user_quota,omitempty"`
	UserBalance  float64           `json:"user_balance,omitempty"`
	CanSettle    bool              `json:"can_settle"`
}

type QuotaNiuniuStatus struct {
	Enabled      bool                   `json:"enabled"`
	GameKey      string                 `json:"game_key"`
	Title        string                 `json:"title"`
	BetAmounts   []int                  `json:"bet_amounts"`
	TableSizes   []int                  `json:"table_sizes"`
	Modes        []string               `json:"modes"`
	UserQuota    int                    `json:"user_quota"`
	UserBalance  float64                `json:"user_balance"`
	CurrentRound *QuotaNiuniuRoundView  `json:"current_round,omitempty"`
	RecentRounds []QuotaNiuniuRoundView `json:"recent_rounds"`
	Rules        []string               `json:"rules"`
	MaxPayout    int                    `json:"max_payout"`
	Multipliers  map[string]float64     `json:"multipliers"`
	DailyLimit   GameDailyLimitView     `json:"daily_limit"`
}

func IsQuotaNiuniuEnabled() bool {
	return IsGamesEnabled() && common.GetEnvOrDefaultBool("GAME_FIVE_ENABLED", true)
}

func GetQuotaNiuniuStatus(userId int) (*QuotaNiuniuStatus, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}

	var current GameQuotaNiuniuRound
	var currentView *QuotaNiuniuRoundView
	err = DB.Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyQuotaNiuniu, QuotaNiuniuStatusPlaying).
		Order("id desc").
		First(&current).Error
	if err == nil {
		view, err := quotaNiuniuRoundToView(&current, false)
		if err != nil {
			return nil, err
		}
		view.UserQuota = userQuota
		view.UserBalance = quotaToAmount(userQuota)
		currentView = view
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var rounds []GameQuotaNiuniuRound
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyQuotaNiuniu).
		Order("id desc").
		Limit(20).
		Find(&rounds).Error; err != nil {
		return nil, err
	}

	recent := make([]QuotaNiuniuRoundView, 0, len(rounds))
	for _, round := range rounds {
		view, err := quotaNiuniuRoundToView(&round, round.Status == QuotaNiuniuStatusSettled)
		if err != nil {
			return nil, err
		}
		recent = append(recent, *view)
	}
	dailyLimit, err := GetGameDailyLimit(userId)
	if err != nil {
		return nil, err
	}

	return &QuotaNiuniuStatus{
		Enabled:      IsQuotaNiuniuEnabled(),
		GameKey:      GameKeyQuotaNiuniu,
		Title:        "额度斗牛",
		BetAmounts:   quotaNiuniuBetAmounts,
		TableSizes:   quotaNiuniuTableSizes,
		Modes:        []string{QuotaNiuniuModeBanker, QuotaNiuniuModeGrab},
		UserQuota:    userQuota,
		UserBalance:  quotaToAmount(userQuota),
		CurrentRound: currentView,
		RecentRounds: recent,
		Rules:        quotaNiuniuRules,
		MaxPayout:    QuotaNiuniuMaxPayoutAmount,
		Multipliers:  quotaNiuniuMultipliers(),
		DailyLimit:   dailyLimit,
	}, nil
}

func CreateQuotaNiuniuRound(userId int, betAmount int, tableSize int, mode string) (*QuotaNiuniuRoundView, error) {
	if !isQuotaNiuniuBetAmountAllowed(betAmount) {
		return nil, errors.New("入场额无效")
	}
	if !isQuotaNiuniuTableSizeAllowed(tableSize) {
		return nil, errors.New("桌型无效")
	}
	if mode != QuotaNiuniuModeBanker && mode != QuotaNiuniuModeGrab {
		return nil, errors.New("斗牛模式无效")
	}

	var result *QuotaNiuniuRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing GameQuotaNiuniuRound
		err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyQuotaNiuniu, QuotaNiuniuStatusPlaying).
			First(&existing).Error
		if err == nil {
			return errors.New("已有未结算的额度斗牛牌局，请先完成当前牌局")
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

		seats, bankerSeat := dealQuotaNiuniuSeats(tableSize, mode)
		seatsJSON, err := marshalQuotaNiuniuSeats(seats)
		if err != nil {
			return err
		}
		round := GameQuotaNiuniuRound{
			UserId:     userId,
			GameKey:    GameKeyQuotaNiuniu,
			Status:     QuotaNiuniuStatusPlaying,
			BetAmount:  betAmount,
			BetQuota:   betQuota,
			TableSize:  tableSize,
			Mode:       mode,
			BankerSeat: bankerSeat,
			Seats:      seatsJSON,
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

		view, err := quotaNiuniuRoundToView(&round, false)
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
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度斗牛入场 %d 站内余额，%d 人桌，模式 %s", betAmount, tableSize, mode))
	return result, nil
}

func SettleQuotaNiuniuRound(userId int, roundId int) (*QuotaNiuniuRoundView, error) {
	var result *QuotaNiuniuRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockQuotaNiuniuRound(tx, userId, roundId)
		if err != nil {
			return err
		}

		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if round.Status == QuotaNiuniuStatusSettled {
			view, err := quotaNiuniuRoundToView(round, true)
			if err != nil {
				return err
			}
			view.UserQuota = user.Quota
			view.UserBalance = quotaToAmount(user.Quota)
			result = view
			return nil
		}

		seats, err := unmarshalQuotaNiuniuSeats(round.Seats)
		if err != nil {
			return err
		}
		resultText, tableAmount, settlements := settleQuotaNiuniuSeats(seats, round.BankerSeat, round.BetAmount)
		payoutQuota := applyQuotaNiuniuSettlementAmount(&user, round.BetAmount, tableAmount)

		round.Status = QuotaNiuniuStatusSettled
		round.Result = resultText
		round.PayoutAmount = tableAmount
		round.PayoutQuota = payoutQuota
		round.SettledAt = common.GetTimestamp()
		if err := tx.Save(round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		if err := recordGameDailyNetQuota(tx, userId, payoutQuota); err != nil {
			return err
		}

		view, err := quotaNiuniuRoundToView(round, true)
		if err != nil {
			return err
		}
		applyQuotaNiuniuSettlements(view.Seats, settlements)
		view.UserQuota = user.Quota
		view.UserBalance = quotaToAmount(user.Quota)
		result = view
		return nil
	})
	if err != nil {
		return nil, err
	}

	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度斗牛结算，结果：%s，结算金额 %.2f 站内余额", result.Result, result.PayoutAmount))
	return result, nil
}

func lockQuotaNiuniuRound(tx *gorm.DB, userId int, roundId int) (*GameQuotaNiuniuRound, error) {
	var round GameQuotaNiuniuRound
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ? AND user_id = ? AND game_key = ?", roundId, userId, GameKeyQuotaNiuniu).
		First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("额度斗牛记录不存在")
		}
		return nil, err
	}
	return &round, nil
}

func isQuotaNiuniuBetAmountAllowed(amount int) bool {
	for _, allowed := range quotaNiuniuBetAmounts {
		if amount == allowed {
			return true
		}
	}
	return false
}

func isQuotaNiuniuTableSizeAllowed(tableSize int) bool {
	for _, allowed := range quotaNiuniuTableSizes {
		if tableSize == allowed {
			return true
		}
	}
	return false
}

func dealQuotaNiuniuSeats(tableSize int, mode string) ([]quotaNiuniuSeatState, int) {
	deck := newQuotaNiuniuDeck()
	rand.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
	seats := make([]quotaNiuniuSeatState, 0, tableSize)
	for seat := 0; seat < tableSize; seat++ {
		grabScore := 0
		if mode == QuotaNiuniuModeGrab {
			grabScore = rand.Intn(4)
		}
		seats = append(seats, quotaNiuniuSeatState{
			Seat:      seat,
			IsUser:    seat == QuotaNiuniuUserSeat,
			GrabScore: grabScore,
			Cards:     append([]QuotaNiuniuCard{}, deck[seat*5:seat*5+5]...),
		})
	}
	if mode == QuotaNiuniuModeBanker {
		return seats, QuotaNiuniuUserSeat
	}
	bankerSeat := 0
	for _, seat := range seats {
		if seat.GrabScore > seats[bankerSeat].GrabScore {
			bankerSeat = seat.Seat
		}
	}
	return seats, bankerSeat
}

func newQuotaNiuniuDeck() []QuotaNiuniuCard {
	suits := []string{"spade", "heart", "club", "diamond"}
	deck := make([]QuotaNiuniuCard, 0, 52)
	for _, suit := range suits {
		for rank := 1; rank <= 13; rank++ {
			deck = append(deck, QuotaNiuniuCard{Suit: suit, Rank: rank})
		}
	}
	return deck
}

func settleQuotaNiuniuSeats(seats []quotaNiuniuSeatState, bankerSeat int, betAmount int) (string, float64, map[int]quotaNiuniuSettlement) {
	settlements := make(map[int]quotaNiuniuSettlement, len(seats))
	if bankerSeat == QuotaNiuniuUserSeat {
		netAmount := 0.0
		userHand := evaluateQuotaNiuniuHand(seats[QuotaNiuniuUserSeat].Cards)
		for _, seat := range seats {
			if seat.Seat == QuotaNiuniuUserSeat {
				continue
			}
			otherHand := evaluateQuotaNiuniuHand(seat.Cards)
			if compareQuotaNiuniuHands(userHand, otherHand) >= 0 {
				amount := calculateQuotaNiuniuRawAmount(betAmount, userHand.Multiplier)
				netAmount += amount
				settlements[seat.Seat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultLose, Amount: -amount}
			} else {
				amount := calculateQuotaNiuniuRawAmount(betAmount, otherHand.Multiplier)
				netAmount -= amount
				settlements[seat.Seat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultWin, Amount: amount}
			}
		}
		if netAmount > 0 {
			userAmount := capQuotaNiuniuPayout(netAmount)
			settlements[QuotaNiuniuUserSeat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultWin, Amount: userAmount}
			return QuotaNiuniuResultWin, userAmount, settlements
		}
		if netAmount < 0 {
			tableAmount := -calculateQuotaNiuniuRawLoss(betAmount, -netAmount)
			settlements[QuotaNiuniuUserSeat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultLose, Amount: tableAmount}
			return QuotaNiuniuResultLose, tableAmount, settlements
		}
		settlements[QuotaNiuniuUserSeat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultPush, Amount: 0}
		return QuotaNiuniuResultPush, 0, settlements
	}

	userHand := evaluateQuotaNiuniuHand(seats[QuotaNiuniuUserSeat].Cards)
	bankerHand := evaluateQuotaNiuniuHand(seats[bankerSeat].Cards)
	if compareQuotaNiuniuHands(userHand, bankerHand) <= 0 {
		lossAmount := -calculateQuotaNiuniuRawLoss(betAmount, calculateQuotaNiuniuRawAmount(betAmount, bankerHand.Multiplier))
		settlements[QuotaNiuniuUserSeat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultLose, Amount: lossAmount}
		return QuotaNiuniuResultLose, lossAmount, settlements
	}
	payout := calculateQuotaNiuniuPayout(betAmount, userHand.Multiplier)
	settlements[QuotaNiuniuUserSeat] = quotaNiuniuSettlement{Result: QuotaNiuniuResultWin, Amount: payout}
	return QuotaNiuniuResultWin, payout, settlements
}

func evaluateQuotaNiuniuHand(cards []QuotaNiuniuCard) QuotaNiuniuHand {
	sortedCards := append([]QuotaNiuniuCard{}, cards...)
	sort.Slice(sortedCards, func(i, j int) bool {
		return quotaNiuniuRankValue(sortedCards[i].Rank) > quotaNiuniuRankValue(sortedCards[j].Rank)
	})
	tieBreakers := make([]int, 0, len(sortedCards))
	for _, card := range sortedCards {
		tieBreakers = append(tieBreakers, quotaNiuniuRankValue(card.Rank))
	}

	if isQuotaNiuniuFiveSmall(cards) {
		return QuotaNiuniuHand{Type: "five_small", TypeLabel: "五小牛", Multiplier: 5, RankScore: 7, TieBreakers: tieBreakers}
	}
	if isQuotaNiuniuBomb(cards) {
		return QuotaNiuniuHand{Type: "bomb", TypeLabel: "炸弹", Multiplier: 4, RankScore: 6, TieBreakers: tieBreakers}
	}
	if isQuotaNiuniuFiveFlower(cards) {
		return QuotaNiuniuHand{Type: "five_flower", TypeLabel: "五花牛", Multiplier: 3, RankScore: 5, TieBreakers: tieBreakers}
	}
	if isQuotaNiuniuFourFlower(cards) {
		return QuotaNiuniuHand{Type: "four_flower", TypeLabel: "四花牛", Multiplier: 3, RankScore: 4, TieBreakers: tieBreakers}
	}

	point := quotaNiuniuPoint(cards)
	if point == 10 {
		return QuotaNiuniuHand{Type: "niuniu", TypeLabel: "牛牛", Multiplier: 2.5, RankScore: 3, NiuPoint: 10, TieBreakers: tieBreakers}
	}
	if point >= 7 {
		return QuotaNiuniuHand{Type: fmt.Sprintf("niu_%d", point), TypeLabel: fmt.Sprintf("牛%d", point), Multiplier: 1.8, RankScore: 2, NiuPoint: point, TieBreakers: tieBreakers}
	}
	if point >= 1 {
		return QuotaNiuniuHand{Type: fmt.Sprintf("niu_%d", point), TypeLabel: fmt.Sprintf("牛%d", point), Multiplier: 1.6, RankScore: 1, NiuPoint: point, TieBreakers: tieBreakers}
	}
	return QuotaNiuniuHand{Type: "no_niu", TypeLabel: "无牛", Multiplier: 0, RankScore: 0, TieBreakers: tieBreakers}
}

func quotaNiuniuPoint(cards []QuotaNiuniuCard) int {
	values := make([]int, len(cards))
	for i, card := range cards {
		values[i] = quotaNiuniuPointValue(card.Rank)
	}
	for i := 0; i < len(values)-2; i++ {
		for j := i + 1; j < len(values)-1; j++ {
			for k := j + 1; k < len(values); k++ {
				if (values[i]+values[j]+values[k])%10 == 0 {
					rest := 0
					for x := 0; x < len(values); x++ {
						if x != i && x != j && x != k {
							rest += values[x]
						}
					}
					point := rest % 10
					if point == 0 {
						return 10
					}
					return point
				}
			}
		}
	}
	return 0
}

func compareQuotaNiuniuHands(left QuotaNiuniuHand, right QuotaNiuniuHand) int {
	if left.RankScore != right.RankScore {
		if left.RankScore > right.RankScore {
			return 1
		}
		return -1
	}
	if left.NiuPoint != right.NiuPoint {
		if left.NiuPoint > right.NiuPoint {
			return 1
		}
		return -1
	}
	for i := 0; i < len(left.TieBreakers) && i < len(right.TieBreakers); i++ {
		if left.TieBreakers[i] > right.TieBreakers[i] {
			return 1
		}
		if left.TieBreakers[i] < right.TieBreakers[i] {
			return -1
		}
	}
	return 0
}

func isQuotaNiuniuFiveSmall(cards []QuotaNiuniuCard) bool {
	total := 0
	for _, card := range cards {
		if card.Rank >= 5 {
			return false
		}
		total += card.Rank
	}
	return total <= 10
}

func isQuotaNiuniuBomb(cards []QuotaNiuniuCard) bool {
	counts := map[int]int{}
	for _, card := range cards {
		counts[card.Rank]++
	}
	for _, count := range counts {
		if count == 4 {
			return true
		}
	}
	return false
}

func isQuotaNiuniuFiveFlower(cards []QuotaNiuniuCard) bool {
	for _, card := range cards {
		if card.Rank < 11 {
			return false
		}
	}
	return true
}

func isQuotaNiuniuFourFlower(cards []QuotaNiuniuCard) bool {
	flowerCount := 0
	for _, card := range cards {
		if card.Rank >= 11 {
			flowerCount++
		}
	}
	return flowerCount == 4
}

func quotaNiuniuPointValue(rank int) int {
	if rank >= 10 {
		return 10
	}
	return rank
}

func quotaNiuniuRankValue(rank int) int {
	if rank == 1 {
		return 14
	}
	return rank
}

func calculateQuotaNiuniuPayout(betAmount int, multiplier float64) float64 {
	return capQuotaNiuniuPayout(float64(betAmount) * multiplier)
}

func calculateQuotaNiuniuRawAmount(betAmount int, multiplier float64) float64 {
	return math.Floor(float64(betAmount)*multiplier*100+0.000001) / 100
}

func calculateQuotaNiuniuRawLoss(betAmount int, lossAmount float64) float64 {
	minLoss := float64(betAmount)
	if lossAmount < minLoss {
		lossAmount = minLoss
	}
	return math.Floor(lossAmount*100+0.000001) / 100
}

func calculateQuotaNiuniuExtraLoss(betAmount int, tableAmount float64) float64 {
	lossAmount := math.Abs(tableAmount)
	rawLoss := calculateQuotaNiuniuRawLoss(betAmount, lossAmount)
	return math.Floor((rawLoss-float64(betAmount))*100+0.000001) / 100
}

func capQuotaNiuniuPayout(amount float64) float64 {
	payout := math.Floor(amount*100+0.000001) / 100
	if payout > float64(QuotaNiuniuMaxPayoutAmount) {
		return float64(QuotaNiuniuMaxPayoutAmount)
	}
	return payout
}

func quotaNiuniuSignedAmountToQuota(amount float64) int {
	if amount < 0 {
		return -amountToQuota(-amount)
	}
	return amountToQuota(amount)
}

func applyQuotaNiuniuSettlementAmount(user *User, betAmount int, tableAmount float64) int {
	settlementAmount := tableAmount
	if tableAmount < 0 {
		settlementAmount = -calculateQuotaNiuniuExtraLoss(betAmount, tableAmount)
	}
	quota := quotaNiuniuSignedAmountToQuota(settlementAmount)
	if quota > 0 {
		user.Quota += quota
		return quota
	}
	if quota < 0 {
		deductQuota := -quota
		if deductQuota > user.Quota {
			deductQuota = user.Quota
		}
		user.Quota -= deductQuota
		return -deductQuota
	}
	return 0
}

func applyQuotaNiuniuSettlements(seats []QuotaNiuniuSeat, settlements map[int]quotaNiuniuSettlement) {
	for i := range seats {
		settlement, ok := settlements[seats[i].Seat]
		if !ok {
			continue
		}
		seats[i].Result = settlement.Result
	}
}

func quotaNiuniuRoundToView(round *GameQuotaNiuniuRound, revealAll bool) (*QuotaNiuniuRoundView, error) {
	states, err := unmarshalQuotaNiuniuSeats(round.Seats)
	if err != nil {
		return nil, err
	}
	seats := make([]QuotaNiuniuSeat, 0, len(states))
	hands := make(map[int]QuotaNiuniuHand, len(states))
	for _, state := range states {
		hand := evaluateQuotaNiuniuHand(state.Cards)
		hands[state.Seat] = hand
		seat := QuotaNiuniuSeat{
			Seat:      state.Seat,
			IsUser:    state.IsUser,
			IsBanker:  state.Seat == round.BankerSeat,
			GrabScore: state.GrabScore,
		}
		if revealAll || state.IsUser {
			seat.Cards = state.Cards
		} else if len(state.Cards) >= 3 {
			seat.Cards = append([]QuotaNiuniuCard{}, state.Cards[:3]...)
		}
		if revealAll {
			seat.Hand = &hand
		}
		seats = append(seats, seat)
	}
	if revealAll && round.BankerSeat >= 0 && round.BankerSeat < len(states) {
		bankerHand := hands[round.BankerSeat]
		for i := range seats {
			if seats[i].Seat == round.BankerSeat {
				continue
			}
			hand := hands[seats[i].Seat]
			if compareQuotaNiuniuHands(hand, bankerHand) > 0 {
				seats[i].Result = QuotaNiuniuResultWin
			} else {
				seats[i].Result = QuotaNiuniuResultLose
			}
		}
	}
	return &QuotaNiuniuRoundView{
		Id:           round.Id,
		Status:       round.Status,
		Result:       round.Result,
		BetAmount:    round.BetAmount,
		TableSize:    round.TableSize,
		Mode:         round.Mode,
		BankerSeat:   round.BankerSeat,
		Seats:        seats,
		PayoutQuota:  round.PayoutQuota,
		PayoutAmount: round.PayoutAmount,
		NetProfit:    quotaNiuniuRoundNetProfit(round),
		CreatedAt:    round.CreatedAt,
		SettledAt:    round.SettledAt,
		CanSettle:    round.Status == QuotaNiuniuStatusPlaying,
	}, nil
}

func quotaNiuniuRoundNetProfit(round *GameQuotaNiuniuRound) float64 {
	if round.Status != QuotaNiuniuStatusSettled {
		return 0
	}
	if round.BetQuota != 0 || round.PayoutQuota != 0 {
		return quotaToAmount(round.PayoutQuota - round.BetQuota)
	}
	return math.Floor((round.PayoutAmount-float64(round.BetAmount))*100+0.000001) / 100
}

func quotaNiuniuMultipliers() map[string]float64 {
	return map[string]float64{
		"no_niu":      0,
		"niu_1_6":     1.6,
		"niu_7_9":     1.8,
		"niuniu":      2.5,
		"four_flower": 3,
		"five_flower": 3,
		"bomb":        4,
		"five_small":  5,
	}
}

func marshalQuotaNiuniuSeats(seats []quotaNiuniuSeatState) (string, error) {
	data, err := common.Marshal(seats)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func unmarshalQuotaNiuniuSeats(data string) ([]quotaNiuniuSeatState, error) {
	if data == "" {
		return []quotaNiuniuSeatState{}, nil
	}
	var seats []quotaNiuniuSeatState
	if err := common.UnmarshalJsonStr(data, &seats); err != nil {
		return nil, err
	}
	return seats, nil
}
