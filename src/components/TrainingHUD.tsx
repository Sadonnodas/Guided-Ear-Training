import { MAJOR_LEVELS } from "../config/TrainingLevels";
// FIX: Removed unused 'TrainingStage' import

interface TrainingHUDProps {
  stageLabel: string;
  sessionTime: number;
  userDurationMinutes: number;
  setUserDurationMinutes: (m: number) => void;
  activeLevelId: number;
  setActiveLevelId: (id: number) => void;
  handleLevelChange: (id: number) => void;
}

export default function TrainingHUD({
  stageLabel,
  sessionTime,
  userDurationMinutes,
  setUserDurationMinutes,
  activeLevelId,
  handleLevelChange
}: TrainingHUDProps) {

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="training-hud">
      <div className="training-info">
        <div style={{ fontWeight: 'bold' }}>{stageLabel}</div>
        <div style={{ fontSize: '0.9em', opacity: 0.8 }}>
          {formatTime(sessionTime)} / {userDurationMinutes}:00
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
        <select
          value={activeLevelId}
          onChange={(e) => handleLevelChange(Number(e.target.value))}
          className="key-select"
          style={{ width: '100%' }}
        >
          {MAJOR_LEVELS.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="slider-row" style={{ marginTop: '15px' }}>
        <span>Duration: {userDurationMinutes}m</span>
        <input
          type="range" min="1" max="20" step="1"
          value={userDurationMinutes}
          onChange={(e) => setUserDurationMinutes(Number(e.target.value))}
        />
      </div>
    </div>
  );
}