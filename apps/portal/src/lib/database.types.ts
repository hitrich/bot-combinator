export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type JsonRpc = {
  Args: { input: Json };
  Returns: string;
};

export interface Database {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      portal_workspace: {
        Args: Record<never, never>;
        Returns: Json;
      };
      public_showcase: {
        Args: Record<never, never>;
        Returns: Json;
      };
      create_portal_project: JsonRpc;
      update_project_profile: JsonRpc;
      update_project_stage: JsonRpc;
      create_portal_milestone: JsonRpc;
      create_portal_blocker: JsonRpc;
      update_delivery_status: JsonRpc;
      create_portal_cohort: JsonRpc;
      submit_progress_update: JsonRpc;
      create_showcase_item: JsonRpc;
      register_showcase_asset: JsonRpc;
      add_portal_comment: JsonRpc;
      request_visibility_change: JsonRpc;
      decide_visibility_change: JsonRpc;
      revoke_shared_visibility: JsonRpc;
      create_review_request: JsonRpc;
      decide_review_request: JsonRpc;
      import_desktop_submission: JsonRpc;
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
