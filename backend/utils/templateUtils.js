/**
 * Universal Dynamic Template Engine
 * Counts placeholders in the template body and automatically slices the available parameters
 * to strictly match the expected count, preventing Meta API error 132000.
 */
exports.buildTemplatePayload = (template, availableParams) => {
    if (!template || !template.body) {
        console.warn("⚠️ buildTemplatePayload: Missing template body, skipping dynamic params");
        return [];
    }

    // 1. Counts placeholders dynamically: {{\d+}}
    const placeholderMatches = template.body.match(/{{\d+}}/g) || [];
    const placeholderCount = placeholderMatches.length;

    console.log(`🔍 [Template Engine] Found ${placeholderCount} placeholders in template '${template.metaTemplateName}'`);

    // 4. Add safety validation
    if (placeholderCount === 0) {
        console.log("ℹ️ [Template Engine] No placeholders found. Sending without body params.");
        return [];
    }

    if (placeholderCount > availableParams.length) {
        console.error(`❌ [Template Engine] ERROR: Template requires ${placeholderCount} params, but only ${availableParams.length} provided.`);
        // Could throw, but returning sliced array or throwing depends on business logic. The user requested:
        // "If placeholderCount > availableParams.length → log error and skip."
        throw new Error(`Template requires ${placeholderCount} params, but only ${availableParams.length} available.`);
    }

    // 3. Automatically slice parameters
    const finalParams = availableParams.slice(0, placeholderCount);

    // Note: whatsappService already maps to { type: 'text', text: value }, 
    // so returning raw values is correct here.
    return finalParams;
};
