export interface DomainMapping {
  /**
   * Short subdomain
   */
  from: string;
  /**
   * Target host, may include port
   */
  to: string;
  /**
   * Indicates whether mapping should made public
   */
  external?: boolean;
}
