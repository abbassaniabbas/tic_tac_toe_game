export const PRIVACY_SECTIONS = [
  {
    title: "Play without an account",
    text: "Classic AI, local two-player games, Ultimate, puzzles and local Replay Lab work without signing in. Settings, scores and local game history stay on your device. No advertising or analytics SDK is included in this app.",
  },
  {
    title: "When you play online",
    text: "An account uses your email for sign-in codes. Your profile contains a display name and optional handle, language and region. The service stores accepted moves, opponents, match timestamps, ratings, verified puzzle solves, achievements and your board palette to run shared games and restore your progress.",
  },
  {
    title: "Who can see your information",
    text: "Private games and replays are available to their participants. Profile and collection data are private. Public leaderboard visibility starts off; you can choose to publish your handle, selected region and ranked results through Edit profile. Your email and private display name do not appear on the leaderboard.",
  },
  {
    title: "Storage and service providers",
    text: "Online accounts and games use Supabase authentication and hosting services. These services may process connection information such as IP addresses and operational logs. This app does not request camera, microphone or precise-location access. Region is chosen by you.",
  },
  {
    title: "Delete your account",
    text: "In Online, choose Delete account and confirm. This removes your sign-in account, profile, collection and verified solves. Open games are closed. Retained game moves and rating events are anonymized so other participants can review their own matches. Account deletion does not clear local practice stored on your device.",
  },
  {
    title: "Manage local data",
    text: "Native Settings can clear Classic match history and reset scores. Studio lets you restart its current Ultimate game and daily puzzle. To remove all remaining local saves, clear the app or browser storage using your device settings. Signing out keeps offline practice available.",
  },
] as const;
