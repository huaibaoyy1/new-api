package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type magicCubeDrawRequest struct {
	Count int `json:"count"`
}

type magicCubeMilestoneClaimRequest struct {
	MilestoneDraws int `json:"milestone_draws"`
}

type magicCubeExchangeRequest struct {
	ItemId int `json:"item_id"`
}

func ensureMagicCubeEnabled(c *gin.Context) bool {
	if !model.IsGamesEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "游戏板块总开关未开启",
		})
		return false
	}
	if !model.IsMagicCubeGameEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "幸运魔方补给站未开启",
		})
		return false
	}
	return true
}

func GetMagicCubeStatus(c *gin.Context) {
	if !ensureMagicCubeEnabled(c) {
		return
	}

	userId := c.GetInt("id")
	status, err := model.GetMagicCubeStatus(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    status,
	})
}

func DrawMagicCube(c *gin.Context) {
	if !ensureMagicCubeEnabled(c) {
		return
	}

	var req magicCubeDrawRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	userId := c.GetInt("id")
	result, err := model.DrawMagicCube(userId, req.Count)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

func ClaimMagicCubeMilestone(c *gin.Context) {
	if !ensureMagicCubeEnabled(c) {
		return
	}

	var req magicCubeMilestoneClaimRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	userId := c.GetInt("id")
	result, err := model.ClaimMagicCubeMilestone(userId, req.MilestoneDraws)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

func ExchangeMagicCubeItem(c *gin.Context) {
	if !ensureMagicCubeEnabled(c) {
		return
	}

	var req magicCubeExchangeRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数",
		})
		return
	}

	userId := c.GetInt("id")
	result, err := model.ExchangeMagicCubeItem(userId, req.ItemId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

func GetMagicCubeExchangeRecords(c *gin.Context) {
	if !ensureMagicCubeEnabled(c) {
		return
	}

	userId := c.GetInt("id")
	records, err := model.GetMagicCubeExchangeRecords(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    records,
	})
}
