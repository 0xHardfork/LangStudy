package response

import "github.com/gin-gonic/gin"

type Body struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Body{Code: 0, Msg: "success", Data: data})
}

func Fail(c *gin.Context, status int, msg string) {
	c.JSON(status, Body{Code: status, Msg: msg, Data: nil})
}
