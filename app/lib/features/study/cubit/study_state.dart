import '../../dialogue/models/dialogue_model.dart';
import '../../auth/models/auth_model.dart';

class StudyState {
  final Dialogue? currentDialogue;
  final int previewLineIndex;
  final int fillBlankLevel;
  final bool generating;
  final String? generatingError;
  final int? exerciseResultWrongCount;
  final List<DialogueType> dialogueTypes;
  final String selectedTopic;
  final TargetLanguage? selectedLanguage;
  final bool loadingDialogueTypes;

  StudyState({
    this.currentDialogue,
    this.previewLineIndex = 0,
    this.fillBlankLevel = 1,
    this.generating = false,
    this.generatingError,
    this.exerciseResultWrongCount,
    this.dialogueTypes = const [],
    this.selectedTopic = '',
    this.selectedLanguage,
    this.loadingDialogueTypes = false,
  });

  StudyState copyWith({
    Dialogue? Function()? currentDialogue,
    int? previewLineIndex,
    int? fillBlankLevel,
    bool? generating,
    String? Function()? generatingError,
    int? Function()? exerciseResultWrongCount,
    List<DialogueType>? dialogueTypes,
    String? selectedTopic,
    TargetLanguage? Function()? selectedLanguage,
    bool? loadingDialogueTypes,
  }) {
    return StudyState(
      currentDialogue: currentDialogue != null ? currentDialogue() : this.currentDialogue,
      previewLineIndex: previewLineIndex ?? this.previewLineIndex,
      fillBlankLevel: fillBlankLevel ?? this.fillBlankLevel,
      generating: generating ?? this.generating,
      generatingError: generatingError != null ? generatingError() : this.generatingError,
      exerciseResultWrongCount: exerciseResultWrongCount != null ? exerciseResultWrongCount() : this.exerciseResultWrongCount,
      dialogueTypes: dialogueTypes ?? this.dialogueTypes,
      selectedTopic: selectedTopic ?? this.selectedTopic,
      selectedLanguage: selectedLanguage != null ? selectedLanguage() : this.selectedLanguage,
      loadingDialogueTypes: loadingDialogueTypes ?? this.loadingDialogueTypes,
    );
  }
}
