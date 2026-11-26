-- Network revisions stay durable while history presents one entry per drawing gesture.
ALTER TABLE board_history ADD COLUMN ink_gesture text;
CREATE INDEX board_history_ink_gesture_idx ON board_history(board_id,ink_gesture,version DESC) WHERE ink_gesture IS NOT NULL;
