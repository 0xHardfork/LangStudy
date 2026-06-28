package validator

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/locales/en"
	"github.com/go-playground/locales/zh"
	ut "github.com/go-playground/universal-translator"
	val "github.com/go-playground/validator/v10"
	zh_translations "github.com/go-playground/validator/v10/translations/zh"
)

var trans ut.Translator

func Init() error {
	if v, ok := binding.Validator.Engine().(*val.Validate); ok {
		zhT := zh.New()
		enT := en.New()
		uni := ut.New(enT, zhT, enT)

		var found bool
		trans, found = uni.GetTranslator("zh")
		if !found {
			return fmt.Errorf("translator zh not found")
		}

		return zh_translations.RegisterDefaultTranslations(v, trans)
	}
	return nil
}

func Translate(err error) string {
	var errs val.ValidationErrors
	if errors.As(err, &errs) {
		var list []string
		for _, e := range errs {
			list = append(list, e.Translate(trans))
		}
		return strings.Join(list, ", ")
	}
	return err.Error()
}
