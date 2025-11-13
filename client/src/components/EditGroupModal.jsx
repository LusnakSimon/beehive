import React, { useState, useEffect } from 'react';
import './EditGroupModal.css';

const EditGroupModal = ({ show, onClose, group, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: '',
    rules: '',
    coverImage: null,
    icon: null
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState({
    cover: null,
    icon: null
  });

  useEffect(() => {
    if (group && show) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        category: group.category || 'general',
        tags: Array.isArray(group.tags) ? group.tags.join(', ') : (group.tags || ''),
        rules: Array.isArray(group.rules) ? group.rules.join('\n') : (group.rules || ''),
        coverImage: null,
        icon: null
      });
      setPreview({
        cover: group.coverImage || null,
        icon: group.icon || null
      });
    }
  }, [group, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, [type]: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(prev => ({
          ...prev,
          [type === 'coverImage' ? 'cover' : 'icon']: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('category', formData.category);
      
      if (formData.tags) {
        const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
        submitData.append('tags', JSON.stringify(tagsArray));
      }
      
      if (formData.rules) {
        const rulesArray = formData.rules.split('\n').filter(r => r.trim());
        submitData.append('rules', JSON.stringify(rulesArray));
      }

      if (formData.coverImage) {
        submitData.append('coverImage', formData.coverImage);
      }

      if (formData.icon) {
        submitData.append('icon', formData.icon);
      }

      const response = await fetch(`/api/groups/${group._id}`, {
        method: 'PUT',
        credentials: 'include',
        body: submitData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update group');
      }

      const data = await response.json();
      alert('Skupina bola úspešne aktualizovaná!');
      if (onSuccess) onSuccess(data.group);
      onClose();
    } catch (error) {
      console.error('Error updating group:', error);
      alert(error.message || 'Nepodarilo sa aktualizovať skupinu');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Upraviť skupinu</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Názov skupiny *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="Napr. Včelári Bratislava"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Popis</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              maxLength={500}
              placeholder="Stručný popis skupiny..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Kategória</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="general">Všeobecná</option>
              <option value="beekeeping">Včelárstvo</option>
              <option value="local">Lokálna</option>
              <option value="education">Vzdelávanie</option>
              <option value="marketplace">Trhovisko</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tagy (oddelené čiarkou)</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="včely, med, miestne"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rules">Pravidlá skupiny (každé na novom riadku)</label>
            <textarea
              id="rules"
              name="rules"
              value={formData.rules}
              onChange={handleChange}
              rows={4}
              placeholder="1. Buďte úctiví&#10;2. Bez spamu&#10;3. Témy súvisiace s včelárstvom"
            />
          </div>

          <div className="form-group">
            <label>Cover obrázok</label>
            <div className="image-upload-area">
              {preview.cover && (
                <div className="image-preview cover-preview">
                  <img src={preview.cover} alt="Cover preview" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'coverImage')}
                id="coverImage"
              />
              <label htmlFor="coverImage" className="upload-label">
                📸 {preview.cover ? 'Zmeniť cover obrázok' : 'Nahrať cover obrázok'}
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Ikona skupiny</label>
            <div className="image-upload-area">
              {preview.icon && (
                <div className="image-preview icon-preview">
                  <img src={preview.icon} alt="Icon preview" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'icon')}
                id="icon"
              />
              <label htmlFor="icon" className="upload-label">
                🖼️ {preview.icon ? 'Zmeniť ikonu' : 'Nahrať ikonu'}
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Zrušiť
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Ukladám...' : '💾 Uložiť zmeny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupModal;
