declare module "react-geolocated" {
  import type { ReactNode } from "react";

  export interface GeolocatedConfig {
    positionOptions?: PositionOptions;
    userDecisionTimeout?: number;
    watchPosition?: boolean;
    isGeolocationEnabled?: boolean;
    suppressLocationOnMount?: boolean;
  }

  export interface GeolocatedProps extends GeolocatedConfig {
    coords?: GeolocationCoordinates;
    isGeolocationAvailable?: boolean;
    isGeolocationEnabled?: boolean;
    positionError?: GeolocationPositionError;
    getPosition?: () => void;
  }

  export function useGeolocated(config?: GeolocatedConfig): GeolocatedProps;
}
