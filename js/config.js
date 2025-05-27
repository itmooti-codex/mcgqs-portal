export default class Config {
  static apiKey = "zeYfVRNaPP_E-fQxxHelQ";
  static visitorReferralSource = 'Gallagher Melbourne';

  static get wsUrl() {
    return `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }

  static get restUrl() {
    return `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
}
