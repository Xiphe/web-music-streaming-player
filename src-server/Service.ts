export interface Service {
  me(): Promise<SpotifyApi.CurrentUsersProfileResponse>;
}
