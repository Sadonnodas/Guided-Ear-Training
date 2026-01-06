import type { TrainingLevel } from "../types";
import "./TrainingHUD.css"; // We will create this

interface TrainingHUDProps {
  stageLabel: string;
  sessionTime: number;
  userDurationMinutes: number;
  setUserDurationMinutes: (m: number) => void;
  activeLevelId: number;
  setActiveLevelId: (id: number) => void;
  handleLevelChange: (id: number) => void;
  levels: TrainingLevel[];
}

export default function TrainingHUD({
  stageLabel,
  sessionTime,
  userDurationMinutes,
  activeLevelId,
  handleLevelChange,
  levels
}: TrainingHUDProps) {

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = Math.min(100, (sessionTime / (userDurationMinutes * 60)) * 100);

  return (
    <div className="hud-container">
      {/* 1. Level Selector (Clean Dropdown) */}
      <div className="hud-section left">
        <select
          value={activeLevelId}
          onChange={(e) => handleLevelChange(Number(e.target.value))}
          className="hud-select"
        >
          {levels.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* 2. Stage Info (Center) */}
      <div className="hud-section center">
        <span className="hud-stage-label">{stageLabel}</span>
      </div>

      {/* 3. Timer & Progress (Right) */}
      <div className="hud-section right">
        <div className="hud-time">
          {formatTime(sessionTime)} / {userDurationMinutes}m
        </div>
        <div className="hud-progress-track">
           <div className="hud-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}