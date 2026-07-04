import 'package:flutter_bloc/flutter_bloc.dart';
import '../../dialogue/data/repository/dialogue_repository.dart';
import '../../dialogue/models/dialogue_model.dart';
import '../../auth/models/auth_model.dart';
import 'study_state.dart';

class StudyCubit extends Cubit<StudyState> {
  final DialogueRepository _repository;

  StudyCubit(this._repository) : super(StudyState());

  Future<void> loadDialogueTypes() async {
    emit(state.copyWith(loadingDialogueTypes: true));
    try {
      final types = await _repository.getDialogueTypes();
      emit(state.copyWith(dialogueTypes: types, loadingDialogueTypes: false));
    } catch (_) {
      emit(state.copyWith(loadingDialogueTypes: false));
    }
  }

  void selectTopic(String topic) {
    emit(state.copyWith(selectedTopic: topic));
  }

  void selectLanguage(TargetLanguage? lang) {
    emit(state.copyWith(selectedLanguage: () => lang));
  }

  void setExerciseResult(int? wrongCount) {
    emit(state.copyWith(exerciseResultWrongCount: () => wrongCount));
  }

  void changeFillBlankLevel(int level) {
    emit(state.copyWith(fillBlankLevel: level));
  }

  void resetDialogue() {
    emit(state.copyWith(currentDialogue: () => null, previewLineIndex: 0));
  }

  // Returns true if navigated to an active dialogue
  Future<bool> handleStartLearning() async {
    emit(state.copyWith(exerciseResultWrongCount: () => null, generatingError: () => null));
    try {
      final active = await _repository.getActiveDialogue();
      if (active != null) {
        emit(state.copyWith(
          currentDialogue: () => active.dialogue,
          previewLineIndex: active.currentLineIndex,
        ));
        return true;
      }
    } catch (_) {
      // Fall through to returning false (meaning show topic select modal)
    }
    return false;
  }

  Future<void> beginGenerate({
    required String topic,
    required TargetLanguage lang,
    required String nativeLanguage,
    required Function(String route) onRouteReady,
  }) async {
    emit(state.copyWith(generating: true, generatingError: () => null));
    try {
      // 1. Try loading shared dialogue
      try {
        final shared = await _repository.getSharedDialogue(
          topic: topic,
          language: lang.lang,
          level: lang.level,
        );
        emit(state.copyWith(
          currentDialogue: () => shared.dialogue,
          previewLineIndex: shared.currentLineIndex,
          generating: false,
        ));
        onRouteReady(shared.currentLineIndex > 0 ? '/fill-blank' : '/preview');
        return;
      } catch (_) {
        // No shared dialogue, proceed to generate
      }

      // 2. Generate new dialogue
      final dialogue = await _repository.generateDialogue(
        topic: topic,
        language: lang.lang,
        level: lang.level,
      );
      emit(state.copyWith(
        currentDialogue: () => dialogue,
        previewLineIndex: 0,
        generating: false,
      ));
      onRouteReady('/preview');
    } catch (e) {
      emit(state.copyWith(
        generating: false,
        generatingError: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> updateDialogueProgress(int dialogueId, int lineIndex, bool completed) async {
    try {
      await _repository.updateDialogueProgress(
        dialogueId: dialogueId,
        lineIndex: lineIndex,
        completed: completed,
      );
      emit(state.copyWith(previewLineIndex: lineIndex));
    } catch (_) {}
  }

  Future<void> regenerateDialogue({
    required int prevDialogueId,
    required String hint,
    required String nativeLanguage,
  }) async {
    final currentDlg = state.currentDialogue;
    if (currentDlg == null) return;

    emit(state.copyWith(generating: true, generatingError: () => null));
    try {
      final dialogue = await _repository.regenerateDialogue(
        prevDialogueId: prevDialogueId,
        topic: currentDlg.topic,
        language: currentDlg.language,
        level: currentDlg.level,
        hint: hint,
        nativeLanguage: nativeLanguage,
      );
      emit(state.copyWith(
        currentDialogue: () => dialogue,
        previewLineIndex: 0,
        generating: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        generating: false,
        generatingError: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> rejectDialogue(int id) async {
    try {
      await _repository.rejectDialogue(id);
    } catch (_) {}
    resetDialogue();
  }
}
