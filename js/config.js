export default class Config {
  static apiKey = "PLACEHOLDER_API_KEY";
  static visitorReferralSource = 'Gallagher Melbourne';

  static get wsUrl() {
    return `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }

  static get restUrl() {
    return `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
}
