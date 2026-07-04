package auth

import (
	"net/http"
	"strings"

	"github.com/0xHardfork/langstudy/platform/config"
	"github.com/0xHardfork/langstudy/platform/response"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string
		cookie, err := c.Cookie("token")
		if err == nil && cookie != "" {
			tokenStr = cookie
		} else {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if tokenStr == "" {
			response.Fail(c, http.StatusUnauthorized, "missing or invalid authorization token")
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			response.Fail(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, "invalid token claims")
			c.Abort()
			return
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, "invalid user_id in token")
			c.Abort()
			return
		}

		role, _ := claims["role"].(string)

		c.Set("userID", uint(userIDFloat))
		c.Set("userRole", role)
		c.Next()
	}
}

func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("userRole")
		if !exists {
			response.Fail(c, http.StatusUnauthorized, "unauthorized")
			c.Abort()
			return
		}
		role, ok := raw.(string)
		if !ok || role != "admin" {
			response.Fail(c, http.StatusForbidden, "forbidden: admin privileges required")
			c.Abort()
			return
		}
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (uint, error) {
	raw, exists := c.Get("userID")
	if !exists {
		return 0, http.ErrNoCookie
	}
	id, ok := raw.(uint)
	if !ok {
		return 0, http.ErrNoCookie
	}
	return id, nil
}
