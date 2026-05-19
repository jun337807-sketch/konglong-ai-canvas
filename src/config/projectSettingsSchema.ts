export const projectSettingsSchema = {
  version: 1,
  defaultSettings: {
    project: {
      name: '未命名项目',
      description: '',
    },
    system: {
      autoSave: true,
      autoSaveIntervalMs: 30000,
      keepHistoryVersions: 10,
    },
    permissions: {
      public: false,
      collaborators: [],
    },
    export: {
      defaultFormat: 'json',
      includeAssets: true,
    }
  }
};

export type ProjectSettings = typeof projectSettingsSchema.defaultSettings;
