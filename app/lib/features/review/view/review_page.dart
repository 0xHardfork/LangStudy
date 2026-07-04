import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';
import '../cubit/review_cubit.dart';
import '../cubit/review_state.dart';
import 'widgets/dialogue_review_panel.dart';
import 'widgets/grammar_review_panel.dart';

class ReviewPage extends StatefulWidget {
  const ReviewPage({super.key});

  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  String _reviewType = 'dialogue'; // 'dialogue' or 'grammar'

  @override
  void initState() {
    super.initState();
    context.read<ReviewCubit>().loadReviews();
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthCubit>().state;
    final fillBlankLevel = authState is AuthAuthenticated && authState.profile != null
        ? authState.profile!.fillBlankLevel
        : 1;

    final reviewCubit = context.watch<ReviewCubit>();
    final reviewState = reviewCubit.state;

    return Scaffold(
      appBar: AppBar(
        title: const Text('📊 艾宾浩斯复习计划', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SafeArea(
        child: BlocBuilder<ReviewCubit, ReviewState>(
          builder: (context, state) {
            if (state is ReviewLoading || state is ReviewInitial) {
              return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
            }

            if (state is ReviewError) {
              return Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('加载复习数据失败', style: TextStyle(fontSize: 18, color: Colors.red[300], fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(state.message, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => reviewCubit.loadReviews(),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
                      child: const Text('重试', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (state is ReviewLoaded) {
              return SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Tabs
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.withOpacity(0.1)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _reviewType = 'dialogue'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: _reviewType == 'dialogue' ? const Color(0xFF581C87).withOpacity(0.15) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '🔄 听力填空 (${state.dueReviews.length})',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: _reviewType == 'dialogue' ? Colors.purpleAccent : Colors.grey,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _reviewType = 'grammar'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: _reviewType == 'grammar' ? const Color(0xFF581C87).withOpacity(0.15) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '🧠 语法单选 (${state.dueGrammarReviews.length})',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: _reviewType == 'grammar' ? Colors.purpleAccent : Colors.grey,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Tab contents
                    if (_reviewType == 'dialogue')
                      DialogueReviewPanel(
                        reviews: state.dueReviews,
                        allReviews: state.allReviews,
                        fillBlankLevel: fillBlankLevel,
                        onFinish: () => context.go('/'),
                      )
                    else
                      GrammarReviewPanel(
                        grammarReviews: state.dueGrammarReviews,
                        onFinish: () => context.go('/'),
                      ),
                  ],
                ),
              );
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
