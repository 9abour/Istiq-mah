'use client';

import { useState, useEffect, useRef } from 'react';
import { useGeolocated } from 'react-geolocated';
import type { SavedLocation } from '../lib/types';
import { setStored, STORAGE_KEYS } from '../lib/storage';
import './LocationModal.css';

const CAIRO_DEFAULT: SavedLocation = {
  latitude: 30.0444,
  longitude: 31.2357,
  label: 'Cairo, Egypt',
  timezone: 'Africa/Cairo',
};

type LocationModalProps = {
  onConfirm: (location: SavedLocation) => void;
};

export function LocationModal({ onConfirm }: LocationModalProps) {
  const [pendingGeolocation, setPendingGeolocation] = useState(false);
  const confirmedRef = useRef(false);

  const { coords, getPosition, isGeolocationAvailable, isGeolocationEnabled } =
    useGeolocated({
      positionOptions: { enableHighAccuracy: true },
      userDecisionTimeout: 15000,
      watchPosition: false,
    });

  useEffect(() => {
    if (!coords || !pendingGeolocation || confirmedRef.current) return;
    const location: SavedLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: 'My location',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    setStored(STORAGE_KEYS.location, location);
    confirmedRef.current = true;
    onConfirm(location);
    setPendingGeolocation(false);
  }, [coords, pendingGeolocation, onConfirm]);

  const handleUseMyLocation = () => {
    if (coords) {
      const location: SavedLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: 'My location',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      setStored(STORAGE_KEYS.location, location);
      onConfirm(location);
    } else {
      setPendingGeolocation(true);
      getPosition?.();
    }
  };

  const handleUseCairo = () => {
    setStored(STORAGE_KEYS.location, CAIRO_DEFAULT);
    onConfirm(CAIRO_DEFAULT);
  };

  return (
    <div
      className="location-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div className="location-modal">
        <div className="location-modal__icon">📍</div>
        <h2 id="location-modal-title" className="location-modal__title">
          Select your location
        </h2>
        <p className="location-modal__subtitle">
          Prayer times are calculated based on your location. Choose how you’d
          like to set it.
        </p>

        <div className="location-modal__actions">
          {isGeolocationAvailable && isGeolocationEnabled ? (
            <button
              type="button"
              className="location-modal__btn location-modal__btn--primary"
              onClick={handleUseMyLocation}
              disabled={pendingGeolocation}
            >
              {pendingGeolocation
                ? 'Getting location…'
                : 'Use my current location'}
            </button>
          ) : (
            <p className="location-modal__hint">
              Location access is unavailable or denied. Use the default location
              below.
            </p>
          )}

          <button
            type="button"
            className="location-modal__btn location-modal__btn--secondary"
            onClick={handleUseCairo}
          >
            Use Cairo, Egypt (default)
          </button>
        </div>
      </div>
    </div>
  );
}
