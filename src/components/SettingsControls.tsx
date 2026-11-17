import type { RoomSettings } from "../../shared/protocol.js";

const settingOptions: Array<{
  key: keyof RoomSettings;
  label: string;
  options: Array<{ value: string | number; label: string }>;
}> = [
  {
    key: "maxPlayers",
    label: "Players",
    options: Array.from({ length: 19 }, (_, index) => index + 2).map((value) => ({
      value,
      label: `${value} players`,
    })),
  },
  {
    key: "rounds",
    label: "Rounds",
    options: Array.from({ length: 9 }, (_, index) => index + 2).map((value) => ({
      value,
      label: `${value} rounds`,
    })),
  },
  {
    key: "wordCount",
    label: "Word choices",
    options: [1, 2, 3, 4, 5].map((value) => ({
      value,
      label: `${value} ${value === 1 ? "word" : "words"}`,
    })),
  },
  {
    key: "hints",
    label: "Hints",
    options: [0, 1, 2, 3, 4, 5].map((value) => ({
      value,
      label: value === 0 ? "Off" : `${value} ${value === 1 ? "hint" : "hints"}`,
    })),
  },
  {
    key: "wordMode",
    label: "Word mode",
    options: [
      { value: "normal", label: "Normal" },
      { value: "hidden", label: "Hidden" },
    ],
  },
];

interface SettingsControlsProps {
  settings: RoomSettings;
  onChange: (settings: RoomSettings) => void;
  compact?: boolean;
}

export default function SettingsControls({
  settings,
  onChange,
  compact = false,
}: SettingsControlsProps) {
  const update = (key: keyof RoomSettings, value: string | number) => {
    const parsed = key === "wordMode" || key === "visibility" ? value : Number(value);
    onChange({ ...settings, [key]: parsed } as RoomSettings);
  };

  return (
    <div className={`settings-controls${compact ? " settings-controls--compact" : ""}`}>
      {!compact && (
        <div className="settings-title">
          <span className="settings-title-icon">⚙</span>
          <div><strong>Room settings</strong><small>Make it your kind of game.</small></div>
        </div>
      )}
      <div className="settings-grid">
        <label className="setting-field">
          <span>ROOM TYPE</span>
          <select
            value={settings.visibility}
            onChange={(event) => update("visibility", event.target.value)}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label className="setting-field setting-field--range">
          <span><span>DRAW TIME</span><strong>{settings.drawTime} SEC</strong></span>
          <input
            type="range"
            min="15"
            max="240"
            value={settings.drawTime}
            onChange={(event) => update("drawTime", event.target.value)}
            aria-label="Draw time in seconds"
          />
        </label>
        {settingOptions.map(({ key, label, options }) => (
          <label className="setting-field" key={key}>
            <span>{label.toUpperCase()}</span>
            <select
              value={String(settings[key])}
              onChange={(event) => update(key, event.target.value)}
            >
              {options.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
