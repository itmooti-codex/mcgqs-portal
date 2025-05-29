const allJobStatusAndColorAndConditions = [
  { type: "Pending Inspection", color: "#10b981", condition: "Pending Inspection" },
  { type: "Completed", color: "#f59e0b", condition: "Report Sent" },
  { type: "Waiting On Info", color: "#ef4444", condition: "Waiting On Info" },
];
export default class Config {
  static apiKey = "zeYfVRNaPP_E-fQxxHelQ";
  static apiEndpoint = "https://mcgqs.vitalstats.app/api/v1/graphql";
  static visitorReferralSource = 'Gallagher Melbourne';
  static jobStatuses = allJobStatusAndColorAndConditions;
  static get wsUrl() {
    return `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
  static get restUrl() {
    return `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
}
