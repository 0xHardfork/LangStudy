import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/subtitle_repository.dart';
import '../models/subtitle_models.dart';
import 'subtitle_state.dart';

class SubtitleCubit extends Cubit<SubtitleState> {
  final SubtitleRepository _repository;

  SubtitleCubit(this._repository) : super(SubtitleInitial());

  Future<void> loadHistory() async {
    final currentState = state;
    List<SubtitleTopic> shared = [];
    if (currentState is SubtitleLoaded) {
      shared = currentState.sharedHistory;
    }
    emit(SubtitleLoading());
    try {
      final list = await _repository.getSubtitleHistory();
      emit(SubtitleLoaded(history: list, sharedHistory: shared));
    } catch (e) {
      emit(SubtitleError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> getSubtitleTopic(int id) async {
    final currentState = state;
    List<SubtitleTopic> history = [];
    if (currentState is SubtitleLoaded) {
      history = currentState.history;
    }

    emit(SubtitleLoading());
    try {
      final topic = await _repository.getSubtitleTopic(id);
      emit(SubtitleLoaded(history: history, currentTopic: topic));
    } catch (e) {
      emit(SubtitleError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> uploadSubtitle({
    required String filePath,
    required String fileName,
    required String title,
    required String targetLanguage,
    required String nativeLanguage,
    required Function() onSuccess,
  }) async {
    final currentState = state;
    List<SubtitleTopic> history = [];
    if (currentState is SubtitleLoaded) {
      history = currentState.history;
    } else {
      emit(SubtitleLoading());
    }

    final activeState = state;
    if (activeState is SubtitleLoaded) {
      emit(activeState.copyWith(analyzing: true, error: () => null));
    }

    try {
      final topic = await _repository.uploadSubtitle(
        filePath: filePath,
        fileName: fileName,
        title: title,
        targetLanguage: targetLanguage,
        nativeLanguage: nativeLanguage,
      );
      final updatedHistory = List<SubtitleTopic>.from(history)..insert(0, topic);
      emit(SubtitleLoaded(history: updatedHistory, currentTopic: topic));
      onSuccess();
    } catch (e) {
      final errStr = e.toString().replaceAll('Exception: ', '');
      if (activeState is SubtitleLoaded) {
        emit(activeState.copyWith(analyzing: false, error: () => errStr));
      } else {
        emit(SubtitleError(errStr));
      }
    }
  }

  void updateChunkStatus(int chunkId, String status, {String errorMsg = ''}) {
    final currentState = state;
    if (currentState is! SubtitleLoaded || currentState.currentTopic == null) return;

    final currentTopic = currentState.currentTopic!;
    final updatedChunks = currentTopic.chunks?.map((c) {
      if (c.id == chunkId) {
        return SubtitleChunk(
          id: c.id,
          topicId: c.topicId,
          chunkIndex: c.chunkIndex,
          startIndex: c.startIndex,
          endIndex: c.endIndex,
          rawContent: c.rawContent,
          status: status,
          errorMessage: errorMsg,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        );
      }
      return c;
    }).toList();

    final updatedTopic = SubtitleTopic(
      id: currentTopic.id,
      userId: currentTopic.userId,
      title: currentTopic.title,
      originalFileName: currentTopic.originalFileName,
      nativeLanguage: currentTopic.nativeLanguage,
      targetLanguage: currentTopic.targetLanguage,
      status: currentTopic.status,
      isShared: currentTopic.isShared,
      blocks: currentTopic.blocks,
      sentences: currentTopic.sentences,
      chunks: updatedChunks,
      createdAt: currentTopic.createdAt,
    );

    emit(currentState.copyWith(currentTopic: () => updatedTopic));
  }

  Future<void> processSubtitleChunk(int chunkId) async {
    updateChunkStatus(chunkId, 'processing');
    try {
      await _repository.processSubtitleChunk(chunkId);
      updateChunkStatus(chunkId, 'completed');
    } catch (e) {
      updateChunkStatus(chunkId, 'failed', errorMsg: e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> mergeSubtitleTopic(int topicId) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      await _repository.mergeSubtitleTopic(topicId);
      final topic = await _repository.getSubtitleTopic(topicId);
      emit(currentState.copyWith(
        currentTopic: () => topic,
        analyzing: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        analyzing: false,
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> regenerateSubtitleSentence(int sentenceId) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded || currentState.currentTopic == null) return;

    emit(currentState.copyWith(analyzing: true, error: () => null));
    try {
      final freshSentence = await _repository.regenerateSubtitleSentence(sentenceId);
      final currentTopic = currentState.currentTopic!;

      final updatedSentences = currentTopic.sentences?.map((s) {
            return s.id == sentenceId ? freshSentence : s;
          }).toList() ??
          [];

      final updatedTopic = SubtitleTopic(
        id: currentTopic.id,
        userId: currentTopic.userId,
        title: currentTopic.title,
        originalFileName: currentTopic.originalFileName,
        nativeLanguage: currentTopic.nativeLanguage,
        targetLanguage: currentTopic.targetLanguage,
        status: currentTopic.status,
        isShared: currentTopic.isShared,
        createdAt: currentTopic.createdAt,
        blocks: currentTopic.blocks,
        sentences: updatedSentences,
        chunks: currentTopic.chunks,
      );

      emit(currentState.copyWith(
        currentTopic: () => updatedTopic,
        analyzing: false,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        analyzing: false,
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> deleteSubtitleTopic(int id) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded) return;

    try {
      await _repository.deleteSubtitleTopic(id);
      final updatedHistory = currentState.history.where((t) => t.id != id).toList();
      emit(currentState.copyWith(
        history: updatedHistory,
        currentTopic: currentState.currentTopic?.id == id ? () => null : null,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  void resetCurrentTopic() {
    final currentState = state;
    if (currentState is SubtitleLoaded) {
      emit(currentState.copyWith(currentTopic: () => null, error: () => null));
    }
  }

  Future<void> loadSharedHistory() async {
    final currentState = state;
    List<SubtitleTopic> personal = [];
    if (currentState is SubtitleLoaded) {
      personal = currentState.history;
    }
    emit(SubtitleLoading());
    try {
      final list = await _repository.getSharedSubtitles();
      emit(SubtitleLoaded(history: personal, sharedHistory: list));
    } catch (e) {
      emit(SubtitleError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> shareTopic(int id) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded) return;
    try {
      await _repository.shareSubtitleTopic(id);
      final updatedHistory = currentState.history.map((t) {
        if (t.id == id) {
          return SubtitleTopic(
            id: t.id,
            userId: t.userId,
            title: t.title,
            originalFileName: t.originalFileName,
            nativeLanguage: t.nativeLanguage,
            targetLanguage: t.targetLanguage,
            status: t.status,
            isShared: true,
            blocks: t.blocks,
            sentences: t.sentences,
            chunks: t.chunks,
            createdAt: t.createdAt,
          );
        }
        return t;
      }).toList();
      SubtitleTopic? updatedTopic = currentState.currentTopic;
      if (updatedTopic != null && updatedTopic.id == id) {
        updatedTopic = SubtitleTopic(
          id: updatedTopic.id,
          userId: updatedTopic.userId,
          title: updatedTopic.title,
          originalFileName: updatedTopic.originalFileName,
          nativeLanguage: updatedTopic.nativeLanguage,
          targetLanguage: updatedTopic.targetLanguage,
          status: updatedTopic.status,
          isShared: true,
          blocks: updatedTopic.blocks,
          sentences: updatedTopic.sentences,
          chunks: updatedTopic.chunks,
          createdAt: updatedTopic.createdAt,
        );
      }
      emit(currentState.copyWith(
        history: updatedHistory,
        currentTopic: updatedTopic != null ? () => updatedTopic : null,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> unshareTopic(int id) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded) return;
    try {
      await _repository.unshareSubtitleTopic(id);
      final updatedHistory = currentState.history.map((t) {
        if (t.id == id) {
          return SubtitleTopic(
            id: t.id,
            userId: t.userId,
            title: t.title,
            originalFileName: t.originalFileName,
            nativeLanguage: t.nativeLanguage,
            targetLanguage: t.targetLanguage,
            status: t.status,
            isShared: false,
            blocks: t.blocks,
            sentences: t.sentences,
            chunks: t.chunks,
            createdAt: t.createdAt,
          );
        }
        return t;
      }).toList();
      SubtitleTopic? updatedTopic = currentState.currentTopic;
      if (updatedTopic != null && updatedTopic.id == id) {
        updatedTopic = SubtitleTopic(
          id: updatedTopic.id,
          userId: updatedTopic.userId,
          title: updatedTopic.title,
          originalFileName: updatedTopic.originalFileName,
          nativeLanguage: updatedTopic.nativeLanguage,
          targetLanguage: updatedTopic.targetLanguage,
          status: updatedTopic.status,
          isShared: false,
          blocks: updatedTopic.blocks,
          sentences: updatedTopic.sentences,
          chunks: updatedTopic.chunks,
          createdAt: updatedTopic.createdAt,
        );
      }
      emit(currentState.copyWith(
        history: updatedHistory,
        currentTopic: updatedTopic != null ? () => updatedTopic : null,
      ));
    } catch (e) {
      emit(currentState.copyWith(
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }

  Future<void> processSubtitleTopic(int topicId) async {
    final currentState = state;
    if (currentState is! SubtitleLoaded) return;
    try {
      await _repository.processSubtitleTopic(topicId);
    } catch (e) {
      emit(currentState.copyWith(
        error: () => e.toString().replaceAll('Exception: ', ''),
      ));
    }
  }
}
