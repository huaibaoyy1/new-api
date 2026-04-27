package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type lotteryActivityUpsertRequest struct {
	Name               string `json:"name"`
	Enabled            bool   `json:"enabled"`
	Days               int    `json:"days"`
	ConsumeStatus      string `json:"consume_status"`
	CheckinStatus      string `json:"checkin_status"`
	Group              string `json:"group"`
	Keyword            string `json:"keyword"`
	RunTime            string `json:"run_time"`
	WinnerCount        int    `json:"winner_count"`
	RewardQuota        int    `json:"reward_quota"`
	RepeatWinBlockDays int    `json:"repeat_win_block_days"`
	Reason             string `json:"reason"`
}

type lotteryToggleRequest struct {
	Enabled bool `json:"enabled"`
}

func GetLotteryActivities(c *gin.Context) {
	activities, err := model.GetAllLotteryActivities()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, activities)
}

func CreateLotteryActivity(c *gin.Context) {
	var req lotteryActivityUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	activity := &model.LotteryActivity{
		Name:               req.Name,
		Enabled:            req.Enabled,
		Days:               req.Days,
		ConsumeStatus:      req.ConsumeStatus,
		CheckinStatus:      req.CheckinStatus,
		GroupName:          req.Group,
		Keyword:            req.Keyword,
		RunTime:            req.RunTime,
		WinnerCount:        req.WinnerCount,
		RewardQuota:        req.RewardQuota,
		RepeatWinBlockDays: req.RepeatWinBlockDays,
		Reason:             req.Reason,
	}
	if err := activity.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, activity)
}

func UpdateLotteryActivity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	existing, err := model.GetLotteryActivityById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var req lotteryActivityUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	existing.Name = req.Name
	existing.Enabled = req.Enabled
	existing.Days = req.Days
	existing.ConsumeStatus = req.ConsumeStatus
	existing.CheckinStatus = req.CheckinStatus
	existing.GroupName = req.Group
	existing.Keyword = req.Keyword
	existing.RunTime = req.RunTime
	existing.WinnerCount = req.WinnerCount
	existing.RewardQuota = req.RewardQuota
	existing.RepeatWinBlockDays = req.RepeatWinBlockDays
	existing.Reason = req.Reason

	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, existing)
}

func DeleteLotteryActivity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteLotteryActivityById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ToggleLotteryActivity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req lotteryToggleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateLotteryActivityEnabled(id, req.Enabled); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func RunLotteryActivity(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.RunLotteryActivity(id, model.LotteryTriggerTypeManual, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetLotteryActivityRuns(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	runs, total, err := model.GetLotteryActivityRuns(id, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(runs)
	common.ApiSuccess(c, pageInfo)
}

func GetLotteryActivityWinners(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	runId, _ := strconv.Atoi(c.Query("run_id"))
	pageInfo := common.GetPageQuery(c)
	winners, total, err := model.GetLotteryWinners(id, runId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(winners)
	common.ApiSuccess(c, pageInfo)
}
