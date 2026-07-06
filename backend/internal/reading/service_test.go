package reading

import (
	"reflect"
	"testing"
)

func TestSplitSentences(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:  "Basic sentences",
			input: "Hello world. How are you doing? I am fine!",
			expected: []string{
				"Hello world.",
				"How are you doing?",
				"I am fine!",
			},
		},
		{
			name:  "Newlines and spacing",
			input: "First sentence.\nSecond sentence!   Third sentence?",
			expected: []string{
				"First sentence.",
				"Second sentence!",
				"Third sentence?",
			},
		},
		{
			name:     "Empty input",
			input:    "   ",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := splitSentences(tt.input)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("splitSentences() = %v, want %v", got, tt.expected)
			}
		})
	}
}
