import { JSON } from "json-as"
import { Content } from "./classes"
import { injectNodeUid, GraphSchema } from "./dgraph-utils"

const content_schema: GraphSchema = new GraphSchema();

content_schema.node_types.set("Content", {
  id_field: "Content.id",
  relationships: [] 
});

export function buildContentMutationJson(connection: string, content: Content): string {
  var payload = JSON.stringify(content);
  
  payload = injectNodeUid(connection, payload, "Content", content_schema);
  
  return payload;
} 