@json
export class Content {
  @alias("Content.id")
  id!: string;
  
  @alias("Content.title")
  title!: string;

  @alias("Content.url")
  url!: string;

  @alias("Content.type")
  type: string = "";

  @alias("Content.tags")
  tags: string[] = []
}
