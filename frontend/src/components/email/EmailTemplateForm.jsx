import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';
import HtmlEmailEditor from './HtmlEmailEditor';
import api from '../../api/api';

const emptyForm = {
  name: '',
  subject: '',
  template_type: 'html',
  htmlBody: '',
  textBody: '',
  imageUrl: '',
  imageCaption: '',
  variables: [
    { name: 'name', type: 'text', defaultValue: 'John Doe' },
    { name: 'email', type: 'email', defaultValue: 'john@example.com' },
    { name: 'company', type: 'text', defaultValue: 'Acme Corp' },
    { name: 'date', type: 'date', defaultValue: new Date().toLocaleDateString() }
  ]
};

export default function EmailTemplateForm({ editing, onSaved, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [errors, setErrors] = useState({});

  // Load editing data
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || '',
        subject: editing.subject || '',
        template_type: editing.template_type || 'html',
        htmlBody: editing.htmlBody || '',
        textBody: editing.textBody || '',
        imageUrl: editing.imageUrl || '',
        imageCaption: editing.imageCaption || '',
        variables: editing.variables || emptyForm.variables
      });
      setHtmlContent(editing.htmlBody || '');
      setTextContent(editing.textBody || '');
    }
  }, [editing]);

  // Get preview content based on template type with variable replacement
  const getPreviewContent = () => {
    let content = '';
    
    if (form.template_type === 'html') {
      // For HTML templates, use the raw HTML content directly
      content = htmlContent;
    } else if (form.template_type === 'text') {
      // For text templates, escape HTML and preserve line breaks
      content = textContent;
    } else if (form.template_type === 'image') {
      if (form.imageUrl) {
        content = `<div style="text-align: center; max-width: 100%;">
          <img src="${form.imageUrl}" alt="${form.imageCaption || 'Email Image'}" style="max-width: 100%; height: auto; border-radius: 8px;" />
          ${form.imageCaption ? `<p style="margin-top: 12px; font-style: italic; color: #666;">${form.imageCaption}</p>` : ''}
          ${htmlContent ? `<div style="margin-top: 16px;">${htmlContent}</div>` : ''}
        </div>`;
      } else {
        content = '<p style="text-align: center; color: #999; padding: 40px;">No image URL provided</p>';
      }
    }

    // Replace variables with sample values for all template types
    if (form.variables && form.variables.length > 0) {
      form.variables.forEach(variable => {
        if (variable.name && variable.defaultValue) {
          const regex = new RegExp(`{{${variable.name}}}`, 'g');
          content = content.replace(regex, variable.defaultValue);
        }
      });
    }

    return content;
  };

  // Handle template type change with state reset
  const handleTemplateTypeChange = (newType) => {
    setForm(prev => ({
      ...prev,
      template_type: newType,
      // Clear type-specific fields
      htmlBody: '',
      textBody: '',
      imageUrl: '',
      imageCaption: ''
    }));
    
    // Clear content states
    setHtmlContent('');
    setTextContent('');
    
    // Clear validation errors for type-specific fields
    setErrors(prev => ({
      ...prev,
      htmlBody: undefined,
      textBody: undefined,
      imageUrl: undefined
    }));
  };

  // Validate form (type-specific)
  const validateForm = () => {
    const newErrors = {};

    // Common validation for all types
    if (!form.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (!form.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    // Type-specific validation
    if (form.template_type === 'html') {
      if (!htmlContent.trim()) {
        newErrors.htmlBody = 'HTML body is required for HTML templates';
      }
    }

    if (form.template_type === 'text') {
      if (!textContent.trim()) {
        newErrors.textBody = 'Text body is required for text templates';
      }
    }

    if (form.template_type === 'image') {
      if (!form.imageUrl.trim()) {
        newErrors.imageUrl = 'Image URL is required for image templates';
      } else {
        // Validate URL format
        try {
          new URL(form.imageUrl);
        } catch (err) {
          newErrors.imageUrl = 'Image URL must be a valid URL';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Build clean payload based on template type
      const templateData = {
        name: form.name,
        subject: form.subject,
        template_type: form.template_type,
        variables: form.variables
      };

      // Add type-specific content only
      if (form.template_type === 'html') {
        templateData.htmlBody = htmlContent;
      } else if (form.template_type === 'text') {
        templateData.textBody = textContent;
      } else if (form.template_type === 'image') {
        templateData.imageUrl = form.imageUrl;
        templateData.imageCaption = form.imageCaption;
      }

      if (editing) {
        await api.put(`/email-templates/${editing._id}`, templateData);
        alert('Template updated successfully');
      } else {
        await api.post('/email-templates', templateData);
        alert('Template created successfully');
        
        // Reset form after successful creation
        setForm(emptyForm);
        setHtmlContent('');
        setTextContent('');
        setErrors({});
      }

      onSaved?.();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save template: ' + (err?.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addVariable = () => {
    setForm(prev => ({
      ...prev,
      variables: [...prev.variables, { name: '', type: 'text', defaultValue: '' }]
    }));
  };

  const updateVariable = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      variables: prev.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  const removeVariable = (index) => {
    setForm(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editing ? 'Edit Template' : 'Create New Template'}
            </h1>
            <p className="text-gray-600 mt-1">
              Design professional email templates with rich formatting
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Template Type Selection */}
        <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Type</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
              form.template_type === 'html'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="template_type"
                value="html"
                checked={form.template_type === 'html'}
                onChange={(e) => handleTemplateTypeChange(e.target.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    form.template_type === 'html'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {form.template_type === 'html' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span className="block text-sm font-medium text-gray-900">
                    HTML Email
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 ml-7">
                  Rich text with formatting, images, and links
                </p>
              </div>
            </label>

            <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
              form.template_type === 'text'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="template_type"
                value="text"
                checked={form.template_type === 'text'}
                onChange={(e) => handleTemplateTypeChange(e.target.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    form.template_type === 'text'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {form.template_type === 'text' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span className="block text-sm font-medium text-gray-900">
                    Text Email
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 ml-7">
                  Plain text email without formatting
                </p>
              </div>
            </label>

            <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
              form.template_type === 'image'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                name="template_type"
                value="image"
                checked={form.template_type === 'image'}
                onChange={(e) => handleTemplateTypeChange(e.target.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    form.template_type === 'image'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {form.template_type === 'image' && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span className="block text-sm font-medium text-gray-900">
                    Image Email
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 ml-7">
                  Image-based email with optional caption
                </p>
              </div>
            </label>
          </div>
        </div>
        {/* Template Details */}
        <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter template name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.subject ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email subject"
              />
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Content Editor Based on Type */}
        <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {form.template_type === 'html' && 'HTML Content'}
            {form.template_type === 'text' && 'Text Content'}
            {form.template_type === 'image' && 'Image Content'}
          </h2>

          {/* HTML Email Editor */}
          {form.template_type === 'html' && (
            <div className="space-y-6">
              <HtmlEmailEditor
                value={htmlContent}
                onChange={setHtmlContent}
                placeholder="Paste your complete HTML email code here including tables, inline styles, and images..."
              />
              {errors.htmlBody && (
                <p className="text-sm text-red-600">{errors.htmlBody}</p>
              )}
            </div>
          )}

          {/* Text Email Editor */}
          {form.template_type === 'text' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Body *
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                    errors.textBody ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={12}
                  placeholder="Enter your plain text email content here..."
                />
                {errors.textBody && (
                  <p className="mt-1 text-sm text-red-600">{errors.textBody}</p>
                )}
              </div>

              {/* Live Preview - Always Visible */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Live Preview
                  </label>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Plain Text
                  </span>
                </div>
                <div className="border border-gray-200 rounded-lg h-96 overflow-hidden">
                  <div className="p-4 h-full overflow-y-auto bg-gray-50">
                    <div className="bg-white rounded p-4 shadow-[0px_4px_12px_rgba(0,0,0,0.05)]">
                      <pre className="whitespace-pre-wrap font-mono text-sm">{getPreviewContent() || 'Start typing to see preview...'}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Email Editor */}
          {form.template_type === 'image' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL *
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.imageUrl ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://example.com/image.jpg"
                />
                {errors.imageUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.imageUrl}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Caption (Optional)
                </label>
                <textarea
                  value={form.imageCaption}
                  onChange={(e) => setForm(prev => ({ ...prev, imageCaption: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add a caption for your image..."
                />
              </div>

              {/* Live Preview - Always Visible */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Live Preview
                  </label>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Image + HTML Render
                  </span>
                </div>
                <div className="border border-gray-200 rounded-lg h-96 overflow-hidden">
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          body {
                            font-family: Arial, sans-serif;
                            font-size: 14px;
                            line-height: 1.6;
                            margin: 0;
                            padding: 20px;
                            background-color: #ffffff;
                            text-align: center;
                          }
                          img {
                            max-width: 100%;
                            height: auto;
                            border-radius: 8px;
                          }
                        </style>
                      </head>
                      <body>
                        ${getPreviewContent()}
                      </body>
                      </html>
                    `}
                    className="w-full h-full bg-white"
                    title="Image Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>

              {/* Optional HTML Caption Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Optional HTML/Text Caption
                </label>
                <RichTextEditor
                  value={htmlContent}
                  onChange={setHtmlContent}
                  placeholder="Add additional HTML content or text caption..."
                />
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>💡 Pro tip:</strong> Use variables like {'{{name}}'}, {'{{email}}'}, etc. in your content. They will be replaced with actual values when sending emails.
            </p>
          </div>
        </div>

        {/* Variables */}
        <div className="bg-white rounded-[12px] shadow-[0px_4px_12px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Template Variables</h2>
            <button
              type="button"
              onClick={addVariable}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Variable
            </button>
          </div>

          <div className="space-y-3">
            {form.variables.map((variable, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <input
                  type="text"
                  value={variable.name}
                  onChange={(e) => updateVariable(index, 'name', e.target.value)}
                  placeholder="Variable name (e.g., name)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />

                <select
                  value={variable.type}
                  onChange={(e) => updateVariable(index, 'type', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </select>

                <input
                  type="text"
                  value={variable.defaultValue}
                  onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                  placeholder="Default value"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />

                <button
                  type="button"
                  onClick={() => removeVariable(index)}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>How to use variables:</strong> In your template, use <code className="bg-gray-200 px-2 py-1 rounded">{'{{variable_name}}'}</code> syntax.
              Example: <code className="bg-gray-200 px-2 py-1 rounded">{'{{name}}'}</code> will be replaced with recipient's name.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {editing ? "Update Template" : "Create Template"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
