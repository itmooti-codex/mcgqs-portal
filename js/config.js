const allConditionsAndEntities = {
  Jobs: {
    selected: true,
    statuses: [
      { type: "Pending Inspection", color: "#10b981", condition: "Pending Inspection", selected: true },
      { type: "Completed", color: "#f59e0b", condition: "Report Sent", selected: false },
      { type: "Waiting On Info", color: "#ef4444", condition: "Waiting On Info", selected: true }
    ],
    defaultColor: "#f59e0b",
    statusField: "job_status",
    referralField: "Referral_Source"
  },
  Contacts: {
    selected: true,
    statuses: [ 
      // { type: "New Lead", color: "#3b82f6", condition: "New", selected: true },
      // { type: "Customer", color: "#8b5cf6", condition: "Subscribed", selected: true }
    ],
    defaultColor: "#000000",
    statusField: "contact_status",
    referralField: "Referral_Source"
  },
  Properties: {
    selected: true,
    statuses: [
      { type: "Commercial Properties", color: "#22c55e", condition: "Commercial", selected: true },
      { type: "Residential House Properties", color: "#eab308", condition: "Residential House", selected: false }
    ],
    defaultColor: "#0000ff",
    statusField: "type",
    referralField: "Referral_Source"
  }
};

export default class Config {
  static apiKey = "zeYfVRNaPP_E-fQxxHelQ";
  static apiEndpoint = "https://mcgqs.vitalstats.app/api/v1/graphql";
  static visitorReferralSource = "Gallagher Melbourne";
  static entitiesConfig = {
    ...allConditionsAndEntities
  };

  static get wsUrl() {
    return `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
  static get restUrl() {
    return `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${this.apiKey}`;
  }
}
