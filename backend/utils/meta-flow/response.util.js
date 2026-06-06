/**
 * Generates a standard success screen for WhatsApp Flows
 * @param {String} title - The heading text
 * @param {String} message - The body text
 * @returns {Object} - Meta Flow formatted screen object
 */
const generateSuccessScreen = (title = "Success", message = "Your request was submitted successfully.") => {
  return {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: "FLOW_TOKEN",
          some_param_name: "some_param_value"
        }
      }
    }
  };
};

/**
 * Encodes the payload back to Meta Flow standard for navigation or completion
 */
const generateNavigateScreen = (screenName, data = {}) => {
  return {
    screen: screenName,
    data
  };
};

module.exports = {
  generateSuccessScreen,
  generateNavigateScreen
};
