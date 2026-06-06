/**
 * Simple Variable Handler - Two Rules Only
 * Rule 1: AUTO variables (no input shown)
 * Rule 2: MANUAL variables (existing input system)
 */

// AUTO VARIABLES - These are filled automatically, no input shown
const AUTO_VARIABLES = {
  '1': 'contact.name',      // Customer name
  'name': 'contact.name',   // Customer name (alternative)
  'phone': 'contact.phone', // Phone number
  // 'email': 'contact.email',  // Email address (removed)
  'company': 'user.company'  // Company name from user profile
};

/**
 * Check if a variable is AUTO (no input needed)
 */
export const isAutoVariable = (variable) => {
  return AUTO_VARIABLES.hasOwnProperty(variable);
};

/**
 * Get auto-filled value for a variable
 */
export const getAutoValue = (variable, contact = {}, user = {}) => {
  const source = AUTO_VARIABLES[variable];
  if (!source) return null;

  if (source === 'contact.name') {
    return contact.name || 'Valued Customer';
  } else if (source === 'contact.phone') {
    return contact.phone || '';
  } else if (source === 'contact.email') {
    return contact.email || '';
  } else if (source === 'user.company') {
    return user.company || 'Our Company';
  }

  return null;
};

/**
 * Process template variables - separate auto and manual
 */
export const processTemplateVariables = (templateBody, contact = {}, user = {}) => {
  if (!templateBody || typeof templateBody !== 'string') {
    return { autoVariables: [], manualVariables: [], allVariables: [] };
  }

  // Extract variables like {{1}}, {{name}}, {{phone}}, etc.
  const regex = /{{([^}]+)}}/g;
  const matches = templateBody.match(regex) || [];

  const autoVariables = [];
  const manualVariables = [];
  const allVariables = [];

  matches.forEach((match, index) => {
    const variable = match.replace(/[{}]/g, '').trim();

    if (isAutoVariable(variable)) {
      const autoValue = getAutoValue(variable, contact, user);
      autoVariables.push({
        index,
        original: match,
        variable,
        value: autoValue,
        source: AUTO_VARIABLES[variable]
      });
    } else {
      // Manual variable - user must input
      manualVariables.push({
        index,
        original: match,
        variable,
        value: '' // Will be filled by user
      });
    }

    allVariables.push({
      index,
      original: match,
      variable,
      isAuto: isAutoVariable(variable)
    });
  });

  return {
    autoVariables,
    manualVariables,
    allVariables,
    totalVariables: allVariables.length,
    autoCount: autoVariables.length,
    manualCount: manualVariables.length
  };
};

/**
 * Build final parameters array for Meta API
 * Auto variables filled automatically, manual from user input
 */
export const buildFinalParameters = (processedData, manualInputs = {}) => {
  const params = [];

  // Sort by index to maintain correct order
  const sortedVariables = [...processedData.autoVariables, ...processedData.manualVariables]
    .sort((a, b) => a.index - b.index);

  sortedVariables.forEach(({ variable, value, isAuto }) => {
    if (isAuto) {
      // Auto-filled value
      const autoVar = processedData.autoVariables.find(v => v.variable === variable);
      params.push(autoVar ? autoVar.value : '');
    } else {
      // Manual input from user
      params.push(manualInputs[variable] || '');
    }
  });

  return params;
};

/**
 * Generate preview with auto values filled
 */
export const generatePreview = (templateBody, processedData, manualInputs = {}) => {
  let preview = templateBody;

  // Replace auto variables
  processedData.autoVariables.forEach(({ original, value }) => {
    preview = preview.replace(original, value);
  });

  // Replace manual variables (show placeholder if empty)
  processedData.manualVariables.forEach(({ original, variable }) => {
    const value = manualInputs[variable] || `[${variable}]`;
    preview = preview.replace(original, value);
  });

  return preview;
};

export default {
  isAutoVariable,
  getAutoValue,
  processTemplateVariables,
  buildFinalParameters,
  generatePreview,
  AUTO_VARIABLES
};
