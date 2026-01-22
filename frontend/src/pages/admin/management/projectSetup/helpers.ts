// Helper functions for ProjectSetupPage
// Utility functions to reduce code duplication

import { ConfigFormState, StationChildConfig, DEFAULT_CONFIG_FORM } from './types';

/**
 * Normalize category name to snake_case key
 */
export const toSnakeCase = (str: string): string => {
    return str.toLowerCase()
        .replace(/\s*&\s*/g, '_and_')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
};

/**
 * Parse JSON safely with fallback
 */
export const safeJsonParse = <T>(value: string | T, fallback: T): T => {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

/**
 * Create a reset config form state
 */
export const createEmptyConfigForm = (): ConfigFormState => ({
    ...DEFAULT_CONFIG_FORM,
    characteristics: { ...DEFAULT_CONFIG_FORM.characteristics }
});

/**
 * Update a single characteristic in the config form
 */
export const updateCharacteristic = (
    prev: ConfigFormState,
    key: string,
    value: any
): ConfigFormState => ({
    ...prev,
    characteristics: {
        ...prev.characteristics,
        [key]: value
    }
});

/**
 * Extract config for a specific child from station
 */
export const getChildConfig = (
    childConfigs: StationChildConfig[] | undefined,
    childId: string
): StationChildConfig | undefined => {
    if (!childConfigs || !Array.isArray(childConfigs)) return undefined;
    return childConfigs.find(c => c.child_category_id === childId);
};

/**
 * Parse station child config into form state
 */
export const parseConfigToFormState = (
    config: StationChildConfig | undefined
): ConfigFormState => {
    if (!config) return createEmptyConfigForm();

    const guideImages = safeJsonParse(config.guide_images as any, []);
    const processIds = safeJsonParse(config.process_ids as any, []);

    return {
        process_ids: processIds,
        characteristics: {
            guide_text: config.guide_text || '',
            image_count: config.image_count || 0,
            guide_images: guideImages,
            project_classification_id: config.project_classification_id || ''
        }
    };
};

/**
 * Build config payload for API save
 */
export const buildConfigPayload = (
    childId: string,
    configForm: ConfigFormState
) => ({
    child_category_id: childId,
    config: {
        process_ids: configForm.process_ids || [],
        guide_text: configForm.characteristics.guide_text || '',
        guide_images: configForm.characteristics.guide_images || [],
        image_count: parseInt(String(configForm.characteristics.image_count)) || 0,
        project_classification_id: configForm.characteristics.project_classification_id || ''
    }
});

/**
 * Update stationsMap after saving config
 */
export const updateStationsMapAfterSave = (
    prev: Record<string, any[]>,
    stationId: string,
    childId: string,
    newConfig: StationChildConfig
): Record<string, any[]> => {
    const next = { ...prev };

    for (const mainCatId in next) {
        const stations = next[mainCatId];
        const stationIndex = stations.findIndex(s => s.id === stationId);

        if (stationIndex !== -1) {
            const updatedStations = [...stations];
            const updatedStation = { ...updatedStations[stationIndex] };

            let childConfigs = updatedStation.child_configs
                ? [...updatedStation.child_configs]
                : [];

            const configIdx = childConfigs.findIndex(
                (c: any) => c.child_category_id === childId
            );

            if (configIdx >= 0) {
                childConfigs[configIdx] = newConfig;
            } else {
                childConfigs.push(newConfig);
            }

            updatedStation.child_configs = childConfigs;
            updatedStations[stationIndex] = updatedStation;
            next[mainCatId] = updatedStations;
            break;
        }
    }

    return next;
};
