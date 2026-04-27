package service

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var lotterySchedulerMutex sync.Mutex

func getLotterySchedulerLocation() *time.Location {
	tz := strings.TrimSpace(os.Getenv("TZ"))
	if tz == "" {
		return time.Local
	}
	location, err := time.LoadLocation(tz)
	if err != nil {
		common.SysError(fmt.Sprintf("lottery scheduler: invalid TZ %q, fallback to local time: %v", tz, err))
		return time.Local
	}
	return location
}

func StartLotteryScheduler() {
	go func() {
		location := getLotterySchedulerLocation()
		now := time.Now().In(location)
		nextMinute := now.Truncate(time.Minute).Add(time.Minute)
		time.Sleep(time.Until(nextMinute))

		runLotterySchedulerTick()

		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			runLotterySchedulerTick()
		}
	}()
}

func shouldRunLotteryActivity(activity *model.LotteryActivity, today string, currentHHMM string) bool {
	if activity == nil || !activity.Enabled {
		return false
	}
	if activity.LastRunDate == today {
		return false
	}
	return activity.RunTime <= currentHHMM
}

func runLotterySchedulerTick() {
	lotterySchedulerMutex.Lock()
	defer lotterySchedulerMutex.Unlock()

	activities, err := model.GetAllLotteryActivities()
	if err != nil {
		common.SysError(fmt.Sprintf("lottery scheduler: load activities failed: %v", err))
		return
	}

	now := time.Now().In(getLotterySchedulerLocation())
	today := now.Format("2006-01-02")
	currentHHMM := now.Format("15:04")

	for _, activity := range activities {
		if !shouldRunLotteryActivity(activity, today, currentHHMM) {
			continue
		}
		if _, err := model.RunLotteryActivity(activity.Id, model.LotteryTriggerTypeSchedule, 0); err != nil {
			common.SysError(fmt.Sprintf("lottery scheduler: run activity %d failed: %v", activity.Id, err))
		} else {
			common.SysLog(fmt.Sprintf("lottery scheduler: activity %d executed at %s", activity.Id, currentHHMM))
		}
	}
}