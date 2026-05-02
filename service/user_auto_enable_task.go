package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	userAutoEnableTickInterval = 1 * time.Minute
	userAutoEnableBatchSize    = 200
)

var (
	userAutoEnableOnce    sync.Once
	userAutoEnableRunning atomic.Bool
)

func StartUserAutoEnableTask() {
	userAutoEnableOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("user auto-enable task started: tick=%s", userAutoEnableTickInterval))
			ticker := time.NewTicker(userAutoEnableTickInterval)
			defer ticker.Stop()

			runUserAutoEnableOnce()
			for range ticker.C {
				runUserAutoEnableOnce()
			}
		})
	})
}

func runUserAutoEnableOnce() {
	if !userAutoEnableRunning.CompareAndSwap(false, true) {
		return
	}
	defer userAutoEnableRunning.Store(false)

	ctx := context.Background()
	totalEnabled := int64(0)
	for {
		n, err := model.AutoEnableDueUsers(userAutoEnableBatchSize)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("user auto-enable task failed: %v", err))
			return
		}
		if n == 0 {
			break
		}
		totalEnabled += n
		if n < userAutoEnableBatchSize {
			break
		}
	}
	if common.DebugEnabled && totalEnabled > 0 {
		logger.LogDebug(ctx, "user auto-enable task: enabled_count=%d", totalEnabled)
	}
}