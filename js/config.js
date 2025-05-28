export default class Config {
  static apiKey = "zeYfVRNaPP_E-fQxxHelQ";
  static apiEndpoint = "https://mcgqs.vitalstats.app/api/v1/graphql";
  static visitorReferralSource = 'Gallagher Melbourne';
  static jobStatusType = "Pending Inspection";
  static jobStatusTypeColor = "#10b981";
  static jobStatusTypeCondtion = "Pending Inspection";
  static get wsUrl() {
    return `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }

  static get restUrl() {
    return `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
}
