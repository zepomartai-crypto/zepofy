/**
 * Simple Backend Variable Handler - Two Rules Only
 * Rule 1: AUTO variables (filled automatically)
 * Rule 2: MANUAL variables (from frontend input)
 */

// AUTO VARIABLES - These are filled automatically
const AUTO_VARIABLES = {
  '1': 'contact.name',      // Customer name
  'name': 'contact.name',   // Customer name (alternative)
  'phone': 'contact.phone', // Phone number
  'email': 'contact.email',  // Email address
  'company': 'user.company'  // Company name from user profile
};

/**
 * Check if a variable is AUTO
 */
const isAutoVariable = (variable) => {
  return AUTO_VARIABLES.hasOwnProperty(variable);
};

/**
 * Get auto-filled value for a variable
 */
const getAutoValue = (variable, contact = {}, user = {}) => {
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
 * Process template variables and build final parameters
 */
const processTemplateVariables = (templateBody, contact = {}, user = {}, manualInputs = {}) => {
  if (!templateBody || typeof templateBody !== 'string') {
    return { parameters: [], autoCount: 0, manualCount: 0 };
  }
  
  // Extract variables like {{1}}, {{name}}, {{phone}}, etc.
  const regex = /{{\s*[^}]+\s*}}/g;
  const matches = templateBody.match(regex) || [];
  
  const parameters = [];
  let autoCount = 0;
  let manualCount = 0;
  
matches.forEach((match) => {
  const variable = match.replace(/[{}]/g, "").trim(); // "1", "2", etc
  const index = Number(variable) - 1; // 👈 VERY IMPORTANT

  if (isAutoVariable(variable)) {
    // AUTO VARIABLE
    const autoValue = getAutoValue(variable, contact, user);
    parameters.push(autoValue ?? "");
    autoCount++;
  } else {
    // MANUAL VARIABLE (FROM ARRAY)
    const manualValue = manualInputs[index];

    if (!manualValue || !manualValue.trim()) {
      parameters.push(undefined); // ❌ missing manual value
    } else {
      parameters.push(manualValue.trim()); // ✅ correct value
    }

    manualCount++;
  }
});


  
  return {
    parameters,
    autoCount,
    manualCount,
    totalVariables: matches.length
  };
};

/**
 * Generate preview with resolved values
 */
const generatePreview = (templateBody, contact = {}, user = {}, manualInputs = {}) => {
  if (!templateBody || typeof templateBody !== 'string') {
    return templateBody || '';
  }
  
  let preview = templateBody;
  
  // Extract variables
  const regex = /{{([^}]+)}}/g;
  const matches = templateBody.match(regex) || [];
  
  matches.forEach((match) => {
    const variable = match.replace(/[{}]/g, '').trim();
    
    if (isAutoVariable(variable)) {
      // Auto-fill variable
      const autoValue = getAutoValue(variable, contact, user);
      preview = preview.replace(match, autoValue || '');
    } else {
      // Manual variable
      const value = manualInputs[variable] || `[${variable}]`;
      preview = preview.replace(match, value);
    }
  });
  
  return preview;
};

module.exports = {
  isAutoVariable,
  getAutoValue,
  processTemplateVariables,
  generatePreview,
  AUTO_VARIABLES
};
