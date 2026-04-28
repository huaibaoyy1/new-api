package model

import (
	"fmt"
	"math/rand"
	"regexp"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

const (
	LotteryRunStatusSuccess = "success"
	LotteryRunStatusFailed  = "failed"
	LotteryRunStatusSkipped = "skipped"

	LotteryTriggerTypeSchedule = "schedule"
	LotteryTriggerTypeManual   = "manual"
)

var lotteryRunTimeRegex = regexp.MustCompile(`^\d{2}:\d{2}$`)

type LotteryActivity struct {
	Id                 int            `json:"id"`
	Name               string         `json:"name" gorm:"type:varchar(128);not null"`
	Enabled            bool           `json:"enabled" gorm:"default:false;index"`
	Days               int            `json:"days" gorm:"default:1"`
	ConsumeStatus      string         `json:"consume_status" gorm:"type:varchar(32);default:'consumed'"`
	MinConsumeQuota    int            `json:"min_consume_quota" gorm:"default:0"`
	CheckinStatus      string         `json:"checkin_status" gorm:"type:varchar(32);default:'all'"`
	GroupName          string         `json:"group" gorm:"column:group_name;type:varchar(64);default:'';index"`
	Keyword            string         `json:"keyword" gorm:"type:varchar(255);default:''"`
	RunTime            string         `json:"run_time" gorm:"type:varchar(5);not null"`
	WinnerCount        int            `json:"winner_count" gorm:"default:1"`
	RewardQuota        int            `json:"reward_quota" gorm:"default:0"`
	RepeatWinBlockDays int            `json:"repeat_win_block_days" gorm:"default:0"`
	Reason             string         `json:"reason" gorm:"type:varchar(255);default:''"`
	LastRunAt          int64          `json:"last_run_at" gorm:"bigint;default:0"`
	LastRunDate        string         `json:"last_run_date" gorm:"type:varchar(10);default:'';index"`
	CreatedAt          int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index"`
}

type LotteryActivityRun struct {
	Id             int            `json:"id"`
	ActivityId     int            `json:"activity_id" gorm:"index"`
	ActivityName   string         `json:"activity_name" gorm:"type:varchar(128);default:''"`
	RunDate        string         `json:"run_date" gorm:"type:varchar(10);index"`
	RunAt          int64          `json:"run_at" gorm:"bigint;index"`
	CandidateCount int            `json:"candidate_count" gorm:"default:0"`
	WinnerCount    int            `json:"winner_count" gorm:"default:0"`
	RewardQuota    int            `json:"reward_quota" gorm:"default:0"`
	Status         string         `json:"status" gorm:"type:varchar(32);default:'success'"`
	Message        string         `json:"message" gorm:"type:text"`
	TriggerType    string         `json:"trigger_type" gorm:"type:varchar(32);default:'schedule'"`
	TriggerUserId  int            `json:"trigger_user_id" gorm:"default:0"`
	CreatedAt      int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
}

type LotteryWinner struct {
	Id          int            `json:"id"`
	ActivityId  int            `json:"activity_id" gorm:"index"`
	RunId       int            `json:"run_id" gorm:"index"`
	UserId      int            `json:"user_id" gorm:"index"`
	Username    string         `json:"username" gorm:"type:varchar(64);default:''"`
	GroupName   string         `json:"group" gorm:"column:group_name;type:varchar(64);default:''"`
	RewardQuota int            `json:"reward_quota" gorm:"default:0"`
	WonAt       int64          `json:"won_at" gorm:"bigint;index"`
	CreatedAt   int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type LotteryActivityExecutionResult struct {
	ActivityId     int              `json:"activity_id"`
	ActivityName   string           `json:"activity_name"`
	RunId          int              `json:"run_id"`
	CandidateCount int              `json:"candidate_count"`
	WinnerCount    int              `json:"winner_count"`
	RewardQuota    int              `json:"reward_quota"`
	Status         string           `json:"status"`
	Message        string           `json:"message"`
	Winners        []*LotteryWinner `json:"winners"`
}

func (LotteryActivity) TableName() string {
	return "lottery_activities"
}

func (LotteryActivityRun) TableName() string {
	return "lottery_activity_runs"
}

func (LotteryWinner) TableName() string {
	return "lottery_winners"
}

func normalizeLotteryStatuses(activity *LotteryActivity) {
	if activity.ConsumeStatus == "" {
		activity.ConsumeStatus = "consumed"
	}
	if activity.CheckinStatus == "" {
		activity.CheckinStatus = "all"
	}
}

func ValidateLotteryActivity(activity *LotteryActivity) error {
	if activity == nil {
		return fmt.Errorf("活动不能为空")
	}
	if activity.Name == "" {
		return fmt.Errorf("活动名称不能为空")
	}
	if !lotteryRunTimeRegex.MatchString(activity.RunTime) {
		return fmt.Errorf("执行时间格式无效，必须为 HH:mm")
	}
	runTime, err := time.Parse("15:04", activity.RunTime)
	if err != nil {
		return fmt.Errorf("执行时间格式无效")
	}
	hour := runTime.Hour()
	minute := runTime.Minute()
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return fmt.Errorf("执行时间无效")
	}
	if activity.Days <= 0 {
		return fmt.Errorf("最近天数必须大于 0")
	}
	if activity.WinnerCount <= 0 {
		return fmt.Errorf("中奖人数必须大于 0")
	}
	if activity.RewardQuota <= 0 {
		return fmt.Errorf("奖励额度必须大于 0")
	}
	if activity.RepeatWinBlockDays < 0 {
		return fmt.Errorf("不可重复中奖天数不能小于 0")
	}
	switch activity.ConsumeStatus {
	case "", "all", "consumed", "not_consumed":
	default:
		return fmt.Errorf("消费状态无效")
	}
	switch activity.CheckinStatus {
	case "", "all", "checked", "not_checked":
	default:
		return fmt.Errorf("签到状态无效")
	}
	normalizeLotteryStatuses(activity)
	return nil
}

func (activity *LotteryActivity) Insert() error {
	if err := ValidateLotteryActivity(activity); err != nil {
		return err
	}
	now := common.GetTimestamp()
	activity.CreatedAt = now
	activity.UpdatedAt = now
	return DB.Create(activity).Error
}

func (activity *LotteryActivity) Update() error {
	if activity.Id == 0 {
		return fmt.Errorf("缺少活动 ID")
	}
	if err := ValidateLotteryActivity(activity); err != nil {
		return err
	}
	activity.UpdatedAt = common.GetTimestamp()
	return DB.Model(&LotteryActivity{}).Where("id = ?", activity.Id).Updates(map[string]any{
		"name":                  activity.Name,
		"enabled":               activity.Enabled,
		"days":                  activity.Days,
		"consume_status":        activity.ConsumeStatus,
		"min_consume_quota":     activity.MinConsumeQuota,
		"checkin_status":        activity.CheckinStatus,
		"group_name":            activity.GroupName,
		"keyword":               activity.Keyword,
		"run_time":              activity.RunTime,
		"winner_count":          activity.WinnerCount,
		"reward_quota":          activity.RewardQuota,
		"repeat_win_block_days": activity.RepeatWinBlockDays,
		"reason":                activity.Reason,
		"updated_at":            activity.UpdatedAt,
	}).Error
}

func GetLotteryActivityById(id int) (*LotteryActivity, error) {
	var activity LotteryActivity
	if err := DB.First(&activity, id).Error; err != nil {
		return nil, err
	}
	normalizeLotteryStatuses(&activity)
	return &activity, nil
}

func GetAllLotteryActivities() ([]*LotteryActivity, error) {
	var activities []*LotteryActivity
	if err := DB.Order("id desc").Find(&activities).Error; err != nil {
		return nil, err
	}
	for _, activity := range activities {
		normalizeLotteryStatuses(activity)
	}
	return activities, nil
}

func DeleteLotteryActivityById(id int) error {
	return DB.Delete(&LotteryActivity{}, id).Error
}

func UpdateLotteryActivityEnabled(id int, enabled bool) error {
	return DB.Model(&LotteryActivity{}).Where("id = ?", id).Updates(map[string]any{
		"enabled":    enabled,
		"updated_at": common.GetTimestamp(),
	}).Error
}

func GetLotteryActivityRuns(activityId int, pageInfo *common.PageInfo) ([]*LotteryActivityRun, int64, error) {
	var runs []*LotteryActivityRun
	var total int64
	query := DB.Model(&LotteryActivityRun{}).Where("activity_id = ?", activityId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&runs).Error; err != nil {
		return nil, 0, err
	}
	return runs, total, nil
}

func GetLotteryWinners(activityId int, runId int, pageInfo *common.PageInfo) ([]*LotteryWinner, int64, error) {
	var winners []*LotteryWinner
	var total int64
	query := DB.Model(&LotteryWinner{}).Where("activity_id = ?", activityId)
	if runId > 0 {
		query = query.Where("run_id = ?", runId)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&winners).Error; err != nil {
		return nil, 0, err
	}
	return winners, total, nil
}

func getLotteryBlockedUserSet(tx *gorm.DB, activityId int, repeatWinBlockDays int, now int64) (map[int]struct{}, error) {
	result := make(map[int]struct{})
	if repeatWinBlockDays <= 0 {
		return result, nil
	}
	cutoff := time.Unix(now, 0).AddDate(0, 0, -repeatWinBlockDays).Unix()
	var userIds []int
	if err := tx.Model(&LotteryWinner{}).
		Where("activity_id = ? AND won_at >= ?", activityId, cutoff).
		Pluck("user_id", &userIds).Error; err != nil {
		return nil, err
	}
	for _, userId := range userIds {
		result[userId] = struct{}{}
	}
	return result, nil
}

func filterLotteryCandidates(activity *LotteryActivity, users []*UserActivityRow, blockedUserSet map[int]struct{}) []*UserActivityRow {
	candidates := make([]*UserActivityRow, 0, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}
		if user.Status != common.UserStatusEnabled {
			continue
		}
		if user.Role >= common.RoleAdminUser {
			continue
		}
		if activity.ConsumeStatus == "consumed" && user.ConsumeCount <= 0 {
			continue
		}
		if activity.MinConsumeQuota > 0 && user.TotalConsumeQuota < int64(activity.MinConsumeQuota) {
			continue
		}
		if _, blocked := blockedUserSet[user.Id]; blocked {
			continue
		}
		candidates = append(candidates, user)
	}
	return candidates
}

func drawLotteryWinners(candidates []*UserActivityRow, winnerCount int) []*UserActivityRow {
	if len(candidates) == 0 || winnerCount <= 0 {
		return []*UserActivityRow{}
	}
	shuffled := make([]*UserActivityRow, len(candidates))
	copy(shuffled, candidates)
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	if winnerCount > len(shuffled) {
		winnerCount = len(shuffled)
	}
	return shuffled[:winnerCount]
}

func RunLotteryActivity(activityId int, triggerType string, triggerUserId int) (*LotteryActivityExecutionResult, error) {
	activity, err := GetLotteryActivityById(activityId)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	runDate := time.Now().Format("2006-01-02")
	filter := UserActivityFilter{
		Days:          activity.Days,
		ConsumeStatus: activity.ConsumeStatus,
		CheckinStatus: activity.CheckinStatus,
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	users, err := GetAllUsersActivity(activity.Keyword, activity.GroupName, filter)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	blockedUserSet, err := getLotteryBlockedUserSet(tx, activity.Id, activity.RepeatWinBlockDays, now)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	candidates := filterLotteryCandidates(activity, users, blockedUserSet)
	run := &LotteryActivityRun{
		ActivityId:     activity.Id,
		ActivityName:   activity.Name,
		RunDate:        runDate,
		RunAt:          now,
		CandidateCount: len(candidates),
		WinnerCount:    0,
		RewardQuota:    activity.RewardQuota,
		Status:         LotteryRunStatusSkipped,
		Message:        "",
		TriggerType:    triggerType,
		TriggerUserId:  triggerUserId,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if len(candidates) == 0 {
		run.Message = "没有符合条件的候选用户"
		if err := tx.Create(run).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Model(&LotteryActivity{}).Where("id = ?", activity.Id).Updates(map[string]any{
			"last_run_at":   now,
			"last_run_date": runDate,
			"updated_at":    now,
		}).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Commit().Error; err != nil {
			return nil, err
		}
		return &LotteryActivityExecutionResult{
			ActivityId:     activity.Id,
			ActivityName:   activity.Name,
			RunId:          run.Id,
			CandidateCount: 0,
			WinnerCount:    0,
			RewardQuota:    activity.RewardQuota,
			Status:         run.Status,
			Message:        run.Message,
			Winners:        []*LotteryWinner{},
		}, nil
	}

	winnerUsers := drawLotteryWinners(candidates, activity.WinnerCount)
	run.WinnerCount = len(winnerUsers)
	run.Status = LotteryRunStatusSuccess
	run.Message = fmt.Sprintf("抽奖完成，候选 %d 人，中奖 %d 人", len(candidates), len(winnerUsers))

	if err := tx.Create(run).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	winners := make([]*LotteryWinner, 0, len(winnerUsers))
	type pendingLog struct {
		userId    int
		content   string
		adminInfo map[string]interface{}
	}
	pendingLogs := make([]pendingLog, 0, len(winnerUsers))

	for _, user := range winnerUsers {
		if err := tx.Model(&User{}).Where("id = ?", user.Id).Update("quota", gorm.Expr("quota + ?", activity.RewardQuota)).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		winner := &LotteryWinner{
			ActivityId:  activity.Id,
			RunId:       run.Id,
			UserId:      user.Id,
			Username:    user.Username,
			GroupName:   user.Group,
			RewardQuota: activity.RewardQuota,
			WonAt:       now,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := tx.Create(winner).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
		pendingLogs = append(pendingLogs, pendingLog{
			userId:  user.Id,
			content: fmt.Sprintf("抽奖活动【%s】中奖，获得额度 %s", activity.Name, logger.LogQuota(activity.RewardQuota)),
			adminInfo: map[string]interface{}{
				"trigger_type":    triggerType,
				"trigger_user_id": triggerUserId,
				"activity_id":     activity.Id,
				"activity_name":   activity.Name,
				"run_id":          run.Id,
			},
		})
		winners = append(winners, winner)
	}

	if err := tx.Model(&LotteryActivity{}).Where("id = ?", activity.Id).Updates(map[string]any{
		"last_run_at":   now,
		"last_run_date": runDate,
		"updated_at":    now,
	}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	for _, item := range pendingLogs {
		RecordLogWithAdminInfo(item.userId, LogTypeManage, item.content, item.adminInfo)
	}

	return &LotteryActivityExecutionResult{
		ActivityId:     activity.Id,
		ActivityName:   activity.Name,
		RunId:          run.Id,
		CandidateCount: len(candidates),
		WinnerCount:    len(winners),
		RewardQuota:    activity.RewardQuota,
		Status:         run.Status,
		Message:        run.Message,
		Winners:        winners,
	}, nil
}