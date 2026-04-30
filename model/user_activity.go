package model

import (
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

type UserActivityFilter struct {
	Days          int
	ConsumeStatus string
	CheckinStatus string
	UserStatus    int
	RiskLevel     string
	MinErrorRate  float64
	MinStatus429  int
}

type UserActivityRow struct {
	User
	TotalTokens       int64   `json:"total_tokens"`
	TotalConsumeQuota int64   `json:"total_consume_quota"`
	ConsumeCount      int64   `json:"consume_count"`
	CheckinCount      int64   `json:"checkin_count"`
	CheckedIn         bool    `json:"checked_in"`
	RiskLevel         string  `json:"risk_level"`
	ErrorRate         float64 `json:"error_rate"`
	Status429         int     `json:"status_429"`
	Status401         int     `json:"status_401"`
	Status403         int     `json:"status_403"`
	Status422         int     `json:"status_422"`
	ErrorCount        int     `json:"error_count"`
	SuccessCount      int     `json:"success_count"`
	TotalRequests     int     `json:"total_requests"`
}

type UserActivitySummary struct {
	TotalUsers       int64 `json:"total_users"`
	ConsumedUsers    int64 `json:"consumed_users"`
	NotConsumedUsers int64 `json:"not_consumed_users"`
	CheckedUsers     int64 `json:"checked_users"`
	NotCheckedUsers  int64 `json:"not_checked_users"`
}

func normalizeUserActivityDays(days int) int {
	if days <= 0 {
		return 1
	}
	if days > 3650 {
		return 3650
	}
	return days
}

func getUserActivityRange(days int) (int64, int64, string, string) {
	days = normalizeUserActivityDays(days)
	now := time.Now()
	location := now.Location()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, -days+1)
	end := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, location)
	return start.Unix(), end.Unix(), start.Format("2006-01-02"), end.Format("2006-01-02")
}

func buildUserActivityQuery(tx *gorm.DB, keyword string, group string, filter UserActivityFilter) *gorm.DB {
	startTimestamp, endTimestamp, startDate, endDate := getUserActivityRange(filter.Days)

	consumeSubQuery := tx.Table("quota_data").
		Select("user_id, COALESCE(SUM(token_used), 0) AS total_tokens, COALESCE(SUM(quota), 0) AS total_consume_quota, COALESCE(SUM(count), 0) AS consume_count").
		Where("created_at >= ? AND created_at <= ?", startTimestamp, endTimestamp).
		Group("user_id")

	checkinSubQuery := tx.Table("checkins").
		Select("user_id, COUNT(*) AS checkin_count").
		Where("checkin_date >= ? AND checkin_date <= ?", startDate, endDate).
		Group("user_id")

	query := tx.Unscoped().
		Model(&User{}).
		Select(`users.*,
COALESCE(consume_stats.total_tokens, 0) AS total_tokens,
COALESCE(consume_stats.total_consume_quota, 0) AS total_consume_quota,
COALESCE(consume_stats.consume_count, 0) AS consume_count,
COALESCE(checkin_stats.checkin_count, 0) AS checkin_count`).
		Joins("LEFT JOIN (?) AS consume_stats ON consume_stats.user_id = users.id", consumeSubQuery).
		Joins("LEFT JOIN (?) AS checkin_stats ON checkin_stats.user_id = users.id", checkinSubQuery)

	if keyword != "" {
		likeCondition := "username LIKE ? OR email LIKE ? OR display_name LIKE ?"
		keywordInt, err := strconv.Atoi(keyword)
		if err == nil {
			likeCondition = "id = ? OR " + likeCondition
			if group != "" {
				query = query.Where("("+likeCondition+") AND "+commonGroupCol+" = ?",
					keywordInt, "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", group)
			} else {
				query = query.Where(likeCondition,
					keywordInt, "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
			}
		} else {
			if group != "" {
				query = query.Where("("+likeCondition+") AND "+commonGroupCol+" = ?",
					"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", group)
			} else {
				query = query.Where(likeCondition,
					"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
			}
		}
	} else if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}

	switch filter.ConsumeStatus {
	case "consumed":
		query = query.Where("COALESCE(consume_stats.consume_count, 0) > 0")
	case "not_consumed":
		query = query.Where("COALESCE(consume_stats.consume_count, 0) = 0")
	}

	switch filter.CheckinStatus {
	case "checked":
		query = query.Where("COALESCE(checkin_stats.checkin_count, 0) > 0")
	case "not_checked":
		query = query.Where("COALESCE(checkin_stats.checkin_count, 0) = 0")
	}

	if filter.UserStatus != 0 {
		query = query.Where("users.status = ?", filter.UserStatus)
	}

	return query
}

func needsUserActivityRiskFilter(filter UserActivityFilter) bool {
	return (filter.RiskLevel != "" && filter.RiskLevel != "all") || filter.MinErrorRate > 0 || filter.MinStatus429 > 0
}

func filterUserActivityRows(users []*UserActivityRow, filter UserActivityFilter) []*UserActivityRow {
	if len(users) == 0 {
		return users
	}
	riskLevel := strings.ToLower(strings.TrimSpace(filter.RiskLevel))
	filtered := make([]*UserActivityRow, 0, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}
		if riskLevel != "" && riskLevel != "all" && strings.ToLower(user.RiskLevel) != riskLevel {
			continue
		}
		if filter.MinErrorRate > 0 && user.ErrorRate < filter.MinErrorRate {
			continue
		}
		if filter.MinStatus429 > 0 && user.Status429 < filter.MinStatus429 {
			continue
		}
		filtered = append(filtered, user)
	}
	return filtered
}

func paginateUserActivityRows(users []*UserActivityRow, startIdx int, pageSize int) []*UserActivityRow {
	if startIdx < 0 {
		startIdx = 0
	}
	if pageSize <= 0 {
		return users
	}
	if startIdx >= len(users) {
		return []*UserActivityRow{}
	}
	endIdx := startIdx + pageSize
	if endIdx > len(users) {
		endIdx = len(users)
	}
	return users[startIdx:endIdx]
}

func fillUserActivityFields(users []*UserActivityRow, days int) {
	userIds := make([]int, 0, len(users))
	for _, user := range users {
		user.CheckedIn = user.CheckinCount > 0
		userIds = append(userIds, user.Id)
	}
	riskSummaryMap, err := GetUsersRequestRiskSummary(userIds, days)
	if err != nil {
		return
	}
	for _, user := range users {
		if risk, ok := riskSummaryMap[user.Id]; ok && risk != nil {
			user.RiskLevel = risk.RiskLevel
			user.ErrorRate = risk.ErrorRate
			user.Status429 = risk.Status429
			user.Status401 = risk.Status401
			user.Status403 = risk.Status403
			user.Status422 = risk.Status422
			user.ErrorCount = risk.ErrorCount
			user.SuccessCount = risk.SuccessCount
			user.TotalRequests = risk.TotalRequests
		}
	}
}

func GetAllUsersActivity(keyword string, group string, filter UserActivityFilter) ([]*UserActivityRow, error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var users []*UserActivityRow
	query := buildUserActivityQuery(tx, keyword, group, filter)
	if err := query.Order("users.id desc").Omit("password").Find(&users).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	fillUserActivityFields(users, filter.Days)
	users = filterUserActivityRows(users, filter)

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return users, nil
}

func GetUserActivitySummary(keyword string, group string, filter UserActivityFilter) (*UserActivitySummary, error) {
	users, err := GetAllUsersActivity(keyword, group, filter)
	if err != nil {
		return nil, err
	}

	summary := &UserActivitySummary{
		TotalUsers: int64(len(users)),
	}
	for _, user := range users {
		if user == nil {
			continue
		}
		if user.ConsumeCount > 0 {
			summary.ConsumedUsers++
		} else {
			summary.NotConsumedUsers++
		}
		if user.CheckedIn {
			summary.CheckedUsers++
		} else {
			summary.NotCheckedUsers++
		}
	}

	return summary, nil
}