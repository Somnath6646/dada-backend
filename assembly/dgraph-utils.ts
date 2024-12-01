import { dgraph } from "@hypermode/modus-sdk-as"
import { JSON } from "json-as"
import { JSON as JSON_TREE} from "assemblyscript-json/assembly/index"

@json
class Uid {
  uid: string = "";
}
@json 
class UidResult {
  uids: Uid[] = [];
}
@json 
export class ListOf<T> {
    list: T[] = [];
}
export class Relationship {
    predicate!: string;
    type!: string;
}
export class NodeType {
    id_field: string = ""
    relationships : Relationship[] = [];
}
export class GraphSchema {
    node_types: Map<string, NodeType> = new Map<string, NodeType>();
}


export function injectNodeUid(connection:string, payload: string, root_type:string, schema: GraphSchema): string {
    
    const root_node_type = schema.node_types.get(root_type);

    const root = <JSON_TREE.Obj>(JSON_TREE.parse(payload));
    injectNodeType(connection, root, root_type, schema);

    console.log("root: " + root.toString())

  return root.toString()
}


function injectNodeType(connection: string, entity: JSON_TREE.Obj | null, type: string, schema: GraphSchema): void {

    if (entity != null) {
      entity.set("dgraph.type", type);
      const node_type = schema.node_types.get(type);
      for (var i = 0; i < node_type.relationships.length; i++) {
        const predicate = node_type.relationships[i].predicate;
        const type = node_type.relationships[i].type;
        injectNodeType(connection, entity.getObj(predicate), type, schema);
      }

      const id_field = entity.getString(node_type.id_field)
      if (id_field != null) {
        const id_value = entity.getString(node_type.id_field)!.toString();
        if (id_value != null) {
          const node_uid = getEntityUid(connection,`${node_type.id_field}`, id_value);
          if (node_uid != null) {
            entity.set("uid", node_uid);
          } else {
            entity.set("uid", `_:${type}-${id_value}`);
          }
        }
      }
    }
}

export function getEntityById<T>(connection: string, predicate: string, id: string, body: string): T | null{
    const query = new dgraph.Query(`{
      list(func: eq(${predicate}, "${id}")) {
          ${body}
        }
      }`);
    const response = dgraph.execute(connection, new dgraph.Request(query));
    const data = JSON.parse<ListOf<T>>(response.Json);
    if (data.list.length > 0) {
      return data.list[0];
    } 
    return null;
  }

function getEntityUid(connection: string,predicate:string, value: string): string | null{

    const query = new dgraph.Query(`{uids(func: eq(${predicate}, "${value}")) {uid}}`);
    const response = dgraph.execute(connection, new dgraph.Request(query ))
    const data = JSON.parse<UidResult>(response.Json)
    if (data.uids.length == 0) {
      return null
    }
    console.log(`${predicate} Uid: ${data.uids[0].uid}`)
    return data.uids[0].uid
  }

  export function deleteNodePredicates(connection:string, criteria: string, predicates: string[]): void {

    const query = new dgraph.Query(`{
        node as var(func: ${criteria}) 
    }`);
    predicates.push("dgraph.type");
    const del_nquads = predicates.map<string>((predicate) => `uid(node) <${predicate}> * .`).join("\n");
    const mutation = new dgraph.Mutation("","","",del_nquads);
    
    dgraph.execute(connection, new dgraph.Request(query, [mutation]));
    
}

export function searchBySimilarity<T>(connection:string, embedding: f32[],predicate:string, body:string, topK: i32, tags: string[] | null = null): T[]{
    let tagFilter = "";
    if (tags !== null && tags.length > 0) {
        tagFilter = ` @filter(has(tags) AND anyofterms(tags, "${tags.join(' ')}"))`;
    }

    const query = `
    query search($vector: float32vector) {
        var(func: similar_to(${predicate},${topK},$vector))${tagFilter}  {    
            vemb as Content.embedding 
            dist as math((vemb - $vector) dot (vemb - $vector))
            score as math(1 - (dist / 2.0))
        } 
        
        list(func:uid(score),orderdesc:val(score))  @filter(gt(val(score),0.25)){ 
            ${body}
        }
    }`
    const vars = new dgraph.Variables();
    vars.set("$vector", JSON.stringify(embedding));
  
    const dgraph_query = new dgraph.Query(query,vars);
  
    const response = dgraph.execute(connection, new dgraph.Request(dgraph_query));
    console.log(response.Json)
    return JSON.parse<ListOf<T>>(response.Json).list
}

export function searchByTags<T>(connection: string, tags: string[], body: string): T[] {
    const query = `{
        list(func: has(tags)) @filter(anyofterms(tags, "${tags.join(' ')}")) {
            ${body}
        }
    }`
    
    const dgraph_query = new dgraph.Query(query);
    const response = dgraph.execute(connection, new dgraph.Request(dgraph_query));
    return JSON.parse<ListOf<T>>(response.Json).list
}

export function addFieldToJson(payload: string, field: string, value: string): string {
    payload = payload.replace("{", `{ \"${field}\":${value},`)
    return payload;
}

export function addEmbeddingToJson(payload: string, predicate: string, embedding: f32[]): string {
    return addFieldToJson(payload, predicate, `"${JSON.stringify(embedding)}"`)
}

export function addTagsToJson(payload: string, tags: string[]): string {
    return addFieldToJson(payload, "tags", `[${tags.map(tag => `"${tag}"`).join(",")}]`)
}

export function getAllContents<T>(connection: string, body: string): T[] {
    const query = `{
        list(func: type(Content)) {
            ${body}
        }
    }`
    
    const dgraph_query = new dgraph.Query(query);
    const response = dgraph.execute(connection, new dgraph.Request(dgraph_query));
    return JSON.parse<ListOf<T>>(response.Json).list
}