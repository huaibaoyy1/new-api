package service

import (
	"sync"
)

var backgroundJobsOnce sync.Once

// StartBackgroundJobs provides a unified entrypoint for long-running background jobs.
// This keeps startup wiring centralized and avoids scattering job startup calls in main.
func StartBackgroundJobs() {
	backgroundJobsOnce.Do(func() {
		StartCodexCredentialAutoRefreshTask()
		StartSubscriptionQuotaResetTask()
		StartLotteryScheduler()
		StartUserAutoEnableTask()
	})
}