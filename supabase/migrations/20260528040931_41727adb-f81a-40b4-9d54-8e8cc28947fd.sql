
ALTER TABLE public.interviews ALTER COLUMN respondent_id DROP NOT NULL;

CREATE TABLE public.telegram_sessions (
  chat_id bigint PRIMARY KEY,
  user_id uuid,
  interview_id uuid,
  study_id uuid,
  state text NOT NULL DEFAULT 'idle',
  pending_question_id uuid,
  pending_is_followup boolean NOT NULL DEFAULT false,
  pending_parent_answer_id uuid,
  pending_question_text text,
  telegram_username text,
  telegram_first_name text,
  awaiting_consent boolean NOT NULL DEFAULT false,
  last_update_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_sessions TO service_role;
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_telegram_sessions_updated_at
BEFORE UPDATE ON public.telegram_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
