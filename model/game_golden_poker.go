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
	GameKeyGoldenPoker = "golden-poker"

	GoldenPokerStatusPlaying = "playing"
	GoldenPokerStatusSettled = "settled"

	GoldenPokerResultWin  = "win"
	GoldenPokerResultLose = "lose"

	GoldenPokerMaxPayoutAmount = 50
)

var goldenPokerBetAmounts = []int{1, 5, 10}

var goldenPokerRules = []string{
	"选择 1、5 或 10 站内余额入场，与系统庄家各持三张牌。",
	"开局后可直接比牌，也可免费换 1 张牌；每局最多换 1 次。",
	"牌型从高到低为：豹子、顺金、金花、顺子、对子、单张。",
	"同牌型按点数比较，完全相同庄家胜。",
	"庄家结算前会自动整理暗牌。",
	"玩家胜利按牌型倍率获得站内余额，单局最高派奖 50 站内余额。",
}

type GamePokerRound struct {
	Id             int     `json:"id"`
	UserId         int     `json:"user_id" gorm:"index"`
	GameKey        string  `json:"game_key" gorm:"type:varchar(64);index"`
	Status         string  `json:"status" gorm:"type:varchar(32);index"`
	BetAmount      int     `json:"bet_amount" gorm:"default:0"`
	BetQuota       int     `json:"bet_quota" gorm:"default:0"`
	PlayerCards    string  `json:"-" gorm:"type:text"`
	DealerCards    string  `json:"-" gorm:"type:text"`
	PlayerHandType string  `json:"player_hand_type" gorm:"type:varchar(32)"`
	DealerHandType string  `json:"dealer_hand_type" gorm:"type:varchar(32)"`
	Swapped        bool    `json:"swapped" gorm:"default:false"`
	Result         string  `json:"result" gorm:"type:varchar(32)"`
	PayoutQuota    int     `json:"payout_quota" gorm:"default:0"`
	PayoutAmount   float64 `json:"payout_amount" gorm:"default:0"`
	CreatedAt      int64   `json:"created_at" gorm:"bigint;autoCreateTime;index"`
	SettledAt      int64   `json:"settled_at" gorm:"bigint;index"`
}

type GoldenPokerCard struct {
	Suit string `json:"suit"`
	Rank int    `json:"rank"`
}

type GoldenPokerHand struct {
	Type        string `json:"type"`
	TypeLabel   string `json:"type_label"`
	RankScore   int    `json:"rank_score"`
	TieBreakers []int  `json:"tie_breakers"`
}

type GoldenPokerRoundView struct {
	Id           int               `json:"id"`
	Status       string            `json:"status"`
	BetAmount    int               `json:"bet_amount"`
	PlayerCards  []GoldenPokerCard `json:"player_cards"`
	DealerCards  []GoldenPokerCard `json:"dealer_cards,omitempty"`
	PlayerHand   GoldenPokerHand   `json:"player_hand"`
	DealerHand   *GoldenPokerHand  `json:"dealer_hand,omitempty"`
	Swapped      bool              `json:"swapped"`
	Result       string            `json:"result,omitempty"`
	PayoutQuota  int               `json:"payout_quota"`
	PayoutAmount float64           `json:"payout_amount"`
	CreatedAt    int64             `json:"created_at"`
	SettledAt    int64             `json:"settled_at,omitempty"`
	UserQuota    int               `json:"user_quota,omitempty"`
	UserBalance  float64           `json:"user_balance,omitempty"`
	CanSwap      bool              `json:"can_swap"`
	CanSettle    bool              `json:"can_settle"`
}

type GoldenPokerStatus struct {
	Enabled       bool                   `json:"enabled"`
	GameKey       string                 `json:"game_key"`
	Title         string                 `json:"title"`
	BetAmounts    []int                  `json:"bet_amounts"`
	UserQuota     int                    `json:"user_quota"`
	UserBalance   float64                `json:"user_balance"`
	CurrentRound  *GoldenPokerRoundView  `json:"current_round,omitempty"`
	RecentRounds  []GoldenPokerRoundView `json:"recent_rounds"`
	Rules         []string               `json:"rules"`
	MaxPayout     int                    `json:"max_payout"`
	HandMultiples map[string]float64     `json:"hand_multiples"`
}

func IsGoldenPokerEnabled() bool {
	return IsGamesEnabled() && common.GetEnvOrDefaultBool("GAME_TWO_ENABLED", true)
}

func GetGoldenPokerStatus(userId int) (*GoldenPokerStatus, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return nil, err
	}

	var current GamePokerRound
	var currentView *GoldenPokerRoundView
	err = DB.Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyGoldenPoker, GoldenPokerStatusPlaying).
		Order("id desc").
		First(&current).Error
	if err == nil {
		view, err := goldenPokerRoundToView(&current, false)
		if err != nil {
			return nil, err
		}
		view.UserQuota = userQuota
		view.UserBalance = quotaToAmount(userQuota)
		currentView = view
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var rounds []GamePokerRound
	if err := DB.Where("user_id = ? AND game_key = ?", userId, GameKeyGoldenPoker).
		Order("id desc").
		Limit(20).
		Find(&rounds).Error; err != nil {
		return nil, err
	}

	recent := make([]GoldenPokerRoundView, 0, len(rounds))
	for _, round := range rounds {
		view, err := goldenPokerRoundToView(&round, round.Status == GoldenPokerStatusSettled)
		if err != nil {
			return nil, err
		}
		recent = append(recent, *view)
	}

	return &GoldenPokerStatus{
		Enabled:       IsGoldenPokerEnabled(),
		GameKey:       GameKeyGoldenPoker,
		Title:         "额度牌局",
		BetAmounts:    goldenPokerBetAmounts,
		UserQuota:     userQuota,
		UserBalance:   quotaToAmount(userQuota),
		CurrentRound:  currentView,
		RecentRounds:  recent,
		Rules:         goldenPokerRules,
		MaxPayout:     GoldenPokerMaxPayoutAmount,
		HandMultiples: goldenPokerMultipliers(),
	}, nil
}

func CreateGoldenPokerRound(userId int, betAmount int) (*GoldenPokerRoundView, error) {
	if !isGoldenPokerBetAmountAllowed(betAmount) {
		return nil, errors.New("入场额无效")
	}

	var result *GoldenPokerRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing GamePokerRound
		err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("user_id = ? AND game_key = ? AND status = ?", userId, GameKeyGoldenPoker, GoldenPokerStatusPlaying).
			First(&existing).Error
		if err == nil {
			return errors.New("已有未结算牌局，请先完成当前牌局")
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

		playerCards, dealerCards := dealGoldenPokerHands()
		playerJSON, err := marshalGoldenPokerCards(playerCards)
		if err != nil {
			return err
		}
		dealerJSON, err := marshalGoldenPokerCards(dealerCards)
		if err != nil {
			return err
		}
		playerHand := evaluateGoldenPokerHand(playerCards)

		round := GamePokerRound{
			UserId:         userId,
			GameKey:        GameKeyGoldenPoker,
			Status:         GoldenPokerStatusPlaying,
			BetAmount:      betAmount,
			BetQuota:       betQuota,
			PlayerCards:    playerJSON,
			DealerCards:    dealerJSON,
			PlayerHandType: playerHand.Type,
		}
		if err := tx.Create(&round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		view, err := goldenPokerRoundToView(&round, false)
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
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度牌局入场 %d 站内余额", betAmount))
	return result, nil
}

func SwapGoldenPokerCard(userId int, roundId int) (*GoldenPokerRoundView, error) {
	var result *GoldenPokerRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockGoldenPokerRound(tx, userId, roundId)
		if err != nil {
			return err
		}
		if round.Status != GoldenPokerStatusPlaying {
			return errors.New("牌局已结算")
		}
		if round.Swapped {
			return errors.New("本局已经换过牌")
		}

		playerCards, err := unmarshalGoldenPokerCards(round.PlayerCards)
		if err != nil {
			return err
		}
		dealerCards, err := unmarshalGoldenPokerCards(round.DealerCards)
		if err != nil {
			return err
		}
		used := append([]GoldenPokerCard{}, playerCards...)
		used = append(used, dealerCards...)
		replacement := drawGoldenPokerReplacement(used)
		replaceIndex := weakestGoldenPokerCardIndex(playerCards)
		playerCards[replaceIndex] = replacement

		playerJSON, err := marshalGoldenPokerCards(playerCards)
		if err != nil {
			return err
		}
		playerHand := evaluateGoldenPokerHand(playerCards)
		round.PlayerCards = playerJSON
		round.PlayerHandType = playerHand.Type
		round.Swapped = true
		if err := tx.Save(round).Error; err != nil {
			return err
		}

		view, err := goldenPokerRoundToView(round, false)
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

func SettleGoldenPokerRound(userId int, roundId int) (*GoldenPokerRoundView, error) {
	var result *GoldenPokerRoundView
	err := DB.Transaction(func(tx *gorm.DB) error {
		round, err := lockGoldenPokerRound(tx, userId, roundId)
		if err != nil {
			return err
		}
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if round.Status == GoldenPokerStatusSettled {
			view, err := goldenPokerRoundToView(round, true)
			if err != nil {
				return err
			}
			view.UserQuota = user.Quota
			view.UserBalance = quotaToAmount(user.Quota)
			result = view
			return nil
		}

		playerCards, err := unmarshalGoldenPokerCards(round.PlayerCards)
		if err != nil {
			return err
		}
		dealerCards, err := unmarshalGoldenPokerCards(round.DealerCards)
		if err != nil {
			return err
		}
		dealerCards = strengthenGoldenPokerDealerCards(dealerCards, playerCards)
		dealerJSON, err := marshalGoldenPokerCards(dealerCards)
		if err != nil {
			return err
		}
		playerHand := evaluateGoldenPokerHand(playerCards)
		dealerHand := evaluateGoldenPokerHand(dealerCards)
		win := compareGoldenPokerHands(playerHand, dealerHand) > 0
		payoutAmount := 0.0
		payoutQuota := 0
		resultText := GoldenPokerResultLose
		if win {
			payoutAmount = calculateGoldenPokerPayout(round.BetAmount, playerHand.Type)
			payoutQuota = amountToQuota(payoutAmount)
			user.Quota += payoutQuota
			resultText = GoldenPokerResultWin
		}

		round.Status = GoldenPokerStatusSettled
		round.PlayerHandType = playerHand.Type
		round.DealerCards = dealerJSON
		round.DealerHandType = dealerHand.Type
		round.Result = resultText
		round.PayoutAmount = payoutAmount
		round.PayoutQuota = payoutQuota
		round.SettledAt = common.GetTimestamp()
		if err := tx.Save(round).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		view, err := goldenPokerRoundToView(round, true)
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
	RecordLog(userId, LogTypeGame, fmt.Sprintf("额度牌局结算，结果：%s，派奖 %.2f 站内余额", result.Result, result.PayoutAmount))
	return result, nil
}

func lockGoldenPokerRound(tx *gorm.DB, userId int, roundId int) (*GamePokerRound, error) {
	var round GamePokerRound
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ? AND user_id = ? AND game_key = ?", roundId, userId, GameKeyGoldenPoker).
		First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("牌局不存在")
		}
		return nil, err
	}
	return &round, nil
}

func isGoldenPokerBetAmountAllowed(amount int) bool {
	for _, allowed := range goldenPokerBetAmounts {
		if amount == allowed {
			return true
		}
	}
	return false
}

func goldenPokerMultipliers() map[string]float64 {
	return map[string]float64{
		"single":         1.15,
		"pair":           1.45,
		"straight":       2.0,
		"flush":          2.6,
		"straight_flush": 4.0,
		"triple":         5.0,
	}
}

func calculateGoldenPokerPayout(betAmount int, handType string) float64 {
	multiplier := goldenPokerMultipliers()[handType]
	if multiplier <= 0 {
		multiplier = 1
	}
	payout := math.Floor(float64(betAmount)*multiplier*100+0.000001) / 100
	if payout > float64(GoldenPokerMaxPayoutAmount) {
		return float64(GoldenPokerMaxPayoutAmount)
	}
	return payout
}

func goldenPokerRoundToView(round *GamePokerRound, revealDealer bool) (*GoldenPokerRoundView, error) {
	playerCards, err := unmarshalGoldenPokerCards(round.PlayerCards)
	if err != nil {
		return nil, err
	}
	playerHand := evaluateGoldenPokerHand(playerCards)
	view := &GoldenPokerRoundView{
		Id:           round.Id,
		Status:       round.Status,
		BetAmount:    round.BetAmount,
		PlayerCards:  playerCards,
		PlayerHand:   playerHand,
		Swapped:      round.Swapped,
		Result:       round.Result,
		PayoutQuota:  round.PayoutQuota,
		PayoutAmount: round.PayoutAmount,
		CreatedAt:    round.CreatedAt,
		SettledAt:    round.SettledAt,
		CanSwap:      round.Status == GoldenPokerStatusPlaying && !round.Swapped,
		CanSettle:    round.Status == GoldenPokerStatusPlaying,
	}
	if revealDealer {
		dealerCards, err := unmarshalGoldenPokerCards(round.DealerCards)
		if err != nil {
			return nil, err
		}
		dealerHand := evaluateGoldenPokerHand(dealerCards)
		view.DealerCards = dealerCards
		view.DealerHand = &dealerHand
	}
	return view, nil
}

func dealGoldenPokerHands() ([]GoldenPokerCard, []GoldenPokerCard) {
	deck := newGoldenPokerDeck()
	rand.Shuffle(len(deck), func(i, j int) {
		deck[i], deck[j] = deck[j], deck[i]
	})
	return append([]GoldenPokerCard{}, deck[:3]...), append([]GoldenPokerCard{}, deck[3:6]...)
}

func newGoldenPokerDeck() []GoldenPokerCard {
	suits := []string{"spade", "heart", "club", "diamond"}
	deck := make([]GoldenPokerCard, 0, 52)
	for _, suit := range suits {
		for rank := 2; rank <= 14; rank++ {
			deck = append(deck, GoldenPokerCard{Suit: suit, Rank: rank})
		}
	}
	return deck
}

func drawGoldenPokerReplacement(used []GoldenPokerCard) GoldenPokerCard {
	usedMap := make(map[string]bool, len(used))
	for _, card := range used {
		usedMap[goldenPokerCardKey(card)] = true
	}
	available := make([]GoldenPokerCard, 0, 46)
	for _, card := range newGoldenPokerDeck() {
		if !usedMap[goldenPokerCardKey(card)] {
			available = append(available, card)
		}
	}
	return available[rand.Intn(len(available))]
}

func strengthenGoldenPokerDealerCards(dealerCards []GoldenPokerCard, playerCards []GoldenPokerCard) []GoldenPokerCard {
	dealerHand := evaluateGoldenPokerHand(dealerCards)
	replaceIndex := -1
	switch dealerHand.Type {
	case "single":
		replaceIndex = weakestGoldenPokerCardIndex(dealerCards)
	case "pair":
		pairRank := goldenPokerPairRank(dealerCards)
		if pairRank > 0 && pairRank <= 10 {
			replaceIndex = goldenPokerKickerIndex(dealerCards, pairRank)
		}
	}
	if replaceIndex < 0 {
		return dealerCards
	}

	used := append([]GoldenPokerCard{}, playerCards...)
	used = append(used, dealerCards...)
	dealerCards = append([]GoldenPokerCard{}, dealerCards...)
	dealerCards[replaceIndex] = drawGoldenPokerReplacement(used)
	return dealerCards
}

func goldenPokerPairRank(cards []GoldenPokerCard) int {
	counts := map[int]int{}
	for _, card := range cards {
		counts[card.Rank]++
	}
	for rank, count := range counts {
		if count == 2 {
			return rank
		}
	}
	return 0
}

func goldenPokerKickerIndex(cards []GoldenPokerCard, pairRank int) int {
	for index, card := range cards {
		if card.Rank != pairRank {
			return index
		}
	}
	return -1
}

func weakestGoldenPokerCardIndex(cards []GoldenPokerCard) int {
	weakest := 0
	for i := 1; i < len(cards); i++ {
		if cards[i].Rank < cards[weakest].Rank {
			weakest = i
		}
	}
	return weakest
}

func evaluateGoldenPokerHand(cards []GoldenPokerCard) GoldenPokerHand {
	sortedCards := append([]GoldenPokerCard{}, cards...)
	sort.Slice(sortedCards, func(i, j int) bool {
		return sortedCards[i].Rank > sortedCards[j].Rank
	})

	ranks := []int{sortedCards[0].Rank, sortedCards[1].Rank, sortedCards[2].Rank}
	flush := sortedCards[0].Suit == sortedCards[1].Suit && sortedCards[1].Suit == sortedCards[2].Suit
	straightRanks, straight := goldenPokerStraightRanks(ranks)
	counts := map[int]int{}
	for _, rank := range ranks {
		counts[rank]++
	}

	if len(counts) == 1 {
		return GoldenPokerHand{Type: "triple", TypeLabel: "豹子", RankScore: 6, TieBreakers: []int{ranks[0]}}
	}
	if flush && straight {
		return GoldenPokerHand{Type: "straight_flush", TypeLabel: "顺金", RankScore: 5, TieBreakers: straightRanks}
	}
	if flush {
		return GoldenPokerHand{Type: "flush", TypeLabel: "金花", RankScore: 4, TieBreakers: ranks}
	}
	if straight {
		return GoldenPokerHand{Type: "straight", TypeLabel: "顺子", RankScore: 3, TieBreakers: straightRanks}
	}
	for rank, count := range counts {
		if count == 2 {
			kicker := 0
			for _, cardRank := range ranks {
				if cardRank != rank {
					kicker = cardRank
					break
				}
			}
			return GoldenPokerHand{Type: "pair", TypeLabel: "对子", RankScore: 2, TieBreakers: []int{rank, kicker}}
		}
	}
	return GoldenPokerHand{Type: "single", TypeLabel: "单张", RankScore: 1, TieBreakers: ranks}
}

func goldenPokerStraightRanks(ranks []int) ([]int, bool) {
	sortedRanks := append([]int{}, ranks...)
	sort.Sort(sort.Reverse(sort.IntSlice(sortedRanks)))
	if sortedRanks[0] == sortedRanks[1]+1 && sortedRanks[1] == sortedRanks[2]+1 {
		return sortedRanks, true
	}
	if sortedRanks[0] == 14 && sortedRanks[1] == 3 && sortedRanks[2] == 2 {
		return []int{3, 2, 1}, true
	}
	return sortedRanks, false
}

func compareGoldenPokerHands(player GoldenPokerHand, dealer GoldenPokerHand) int {
	if player.RankScore != dealer.RankScore {
		if player.RankScore > dealer.RankScore {
			return 1
		}
		return -1
	}
	for i := 0; i < len(player.TieBreakers) && i < len(dealer.TieBreakers); i++ {
		if player.TieBreakers[i] > dealer.TieBreakers[i] {
			return 1
		}
		if player.TieBreakers[i] < dealer.TieBreakers[i] {
			return -1
		}
	}
	return -1
}

func marshalGoldenPokerCards(cards []GoldenPokerCard) (string, error) {
	data, err := common.Marshal(cards)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func unmarshalGoldenPokerCards(data string) ([]GoldenPokerCard, error) {
	var cards []GoldenPokerCard
	if err := common.UnmarshalJsonStr(data, &cards); err != nil {
		return nil, err
	}
	return cards, nil
}

func goldenPokerCardKey(card GoldenPokerCard) string {
	return fmt.Sprintf("%s:%d", card.Suit, card.Rank)
}
