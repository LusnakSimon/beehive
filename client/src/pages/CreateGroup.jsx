import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './CreateGroup.css';

const CreateGroup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    location: '',
    category: 'beekeeping',
    rules: '',
    tags: ''
  });
  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [icon, setIcon] = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const coverInputRef = useRef(null);
  const iconInputRef = useRef(null);

  const categories = [
    { value: 'beekeeping', label: 'Včelárstvo' },
    { value: 'honey-production', label: 'Produkcia medu' },
    { value: 'bee-health', label: 'Zdravie včiel' },
    { value: 'equipment', label: 'Vybavenie' },
    { value: 'education', label: 'Vzdelávanie' },
    { value: 'local-community', label: 'Miestna komunita' },
    { value: 'commercial', label: 'Komerčné' },
    { value: 'hobby', label: 'Hobby' },
    { value: 'research', label: 'Výskum' },
    { value: 'other', label: 'Ostatné' }
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCoverImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Obrázok je príliš veľký (max 5MB)');
        return;
      }
      setCoverImage(file);
      setCoverImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleIconSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Ikona je príliš veľká (max 5MB)');
        return;
      }
      setIcon(file);
      setIconPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Názov skupiny je povinný');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('description', formData.description.trim());
      data.append('privacy', formData.privacy);
      data.append('location', formData.location.trim());
      data.append('category', formData.category);
      data.append('rules', formData.rules.trim());
      data.append('tags', formData.tags);

      if (coverImage) {
        data.append('coverImage', coverImage);
      }
      if (icon) {
        data.append('icon', icon);
      }

      const response = await fetch('/api/groups', {
        method: 'POST',
        credentials: 'include',
        body: data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }

      const result = await response.json();
      
      // Navigate to group page
      navigate(`/groups/${result.group.id}`);
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err.message || 'Nepodarilo sa vytvoriť skupinu');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="loading">Načítavam...</div>;
  }

  return (
    <div className="create-group-page">
      <div className="create-group-container">
        <div className="create-group-header">
          <button className="back-button" onClick={() => navigate('/groups')}>
            ← Späť
          </button>
          <h1>Vytvoriť novú skupinu</h1>
        </div>

        <form className="create-group-form" onSubmit={handleSubmit}>
          {/* Cover Image */}
          <div className="form-section">
            <label className="form-label">Úvodný obrázok (voliteľné)</label>
            <div 
              className="cover-image-upload"
              onClick={() => coverInputRef.current?.click()}
              style={{
                backgroundImage: coverImagePreview 
                  ? `url(${coverImagePreview})` 
                  : 'var(--btn-primary-gradient)'
              }}
            >
              {!coverImagePreview && (
                <div className="upload-placeholder">
                  <span className="upload-icon">📷</span>
                  <span>Kliknite pre pridanie úvodného obrázka</span>
                </div>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverImageSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Icon */}
          <div className="form-section">
            <label className="form-label">Ikona skupiny (voliteľné)</label>
            <div className="icon-upload-row">
              <div 
                className="icon-upload"
                onClick={() => iconInputRef.current?.click()}
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Group icon" className="icon-preview" />
                ) : (
                  <div className="icon-placeholder">
                    <span>+</span>
                  </div>
                )}
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconSelect}
                  style={{ display: 'none' }}
                />
              </div>
              <span className="icon-upload-hint">Štvorec alebo kruh, minimálne 200x200px</span>
            </div>
          </div>

          {/* Basic Info */}
          <div className="form-section">
            <label className="form-label">Názov skupiny *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="napr. Včelári Bratislava"
              className="form-input"
              maxLength="100"
              required
            />
          </div>

          <div className="form-section">
            <label className="form-label">Popis</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Popíšte vašu skupinu..."
              className="form-textarea"
              rows="4"
              maxLength="1000"
            />
          </div>

          {/* Privacy */}
          <div className="form-section">
            <label className="form-label">Súkromie</label>
            <div className="privacy-options">
              <label className="privacy-option">
                <input
                  type="radio"
                  name="privacy"
                  value="public"
                  checked={formData.privacy === 'public'}
                  onChange={handleChange}
                />
                <div className="privacy-option-content">
                  <strong>🌍 Verejná</strong>
                  <span>Ktokoľvek sa môže pripojiť</span>
                </div>
              </label>

              <label className="privacy-option">
                <input
                  type="radio"
                  name="privacy"
                  value="private"
                  checked={formData.privacy === 'private'}
                  onChange={handleChange}
                />
                <div className="privacy-option-content">
                  <strong>🔒 Súkromná</strong>
                  <span>Vyžaduje schválenie admina</span>
                </div>
              </label>

              <label className="privacy-option">
                <input
                  type="radio"
                  name="privacy"
                  value="secret"
                  checked={formData.privacy === 'secret'}
                  onChange={handleChange}
                />
                <div className="privacy-option-content">
                  <strong>🔐 Tajná</strong>
                  <span>Len na pozvánku</span>
                </div>
              </label>
            </div>
          </div>

          {/* Location & Category */}
          <div className="form-row">
            <div className="form-section">
              <label className="form-label">Lokalita</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="napr. Bratislava"
                className="form-input"
                maxLength="100"
              />
            </div>

            <div className="form-section">
              <label className="form-label">Kategória</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="form-select"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rules */}
          <div className="form-section">
            <label className="form-label">Pravidlá skupiny (voliteľné)</label>
            <textarea
              name="rules"
              value={formData.rules}
              onChange={handleChange}
              placeholder="Pravidlá správania v skupine..."
              className="form-textarea"
              rows="4"
              maxLength="2000"
            />
          </div>

          {/* Tags */}
          <div className="form-section">
            <label className="form-label">Tagy (oddelené čiarkou)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="napr. včely, med, opelenie"
              className="form-input"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate('/groups')}
              disabled={submitting}
            >
              Zrušiť
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting || !formData.name.trim()}
            >
              {submitting ? 'Vytváram...' : 'Vytvoriť skupinu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroup;
