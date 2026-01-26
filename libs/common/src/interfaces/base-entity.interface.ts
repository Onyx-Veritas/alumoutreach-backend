export interface IBaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IAuditableEntity extends IBaseEntity {
  createdBy: string;
  updatedBy?: string;
}

export interface ITenantAwareEntity extends IAuditableEntity {
  tenantId: string;
}
