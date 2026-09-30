import { tool } from "langchain";
import { z } from "zod";
import { searchTournaments } from "@/lib/search";
import { recordEngagement } from "@/lib/engagement";
import { getStore } from "@/lib/store";
import { SearchQuerySchema, type Tournament } from "@/lib/types";
import { chatConfig } from "./config";
import { tournamentDetail, tournamentLine } from "./format";

/*
 * Tools return [content, artifact]: `content` is the compact text the model
 * reads (cheap in tokens), `artifact` is the full records the UI renders as
 * cards and is never sent to the model.
 */

// Tool schemas are sent on every model call, so field descriptions stay terse.
const SearchInput = SearchQuerySchema.omit({ limit: true, offset: true });

export const searchTool = tool(
  async (input): Promise<[string, Tournament[]]> => {
    const { items, total } = await searchTournaments({ ...input, limit: chatConfig.searchResultLimit });
    if (items.length === 0) return ["No tournaments match. Try broader filters.", []];
    const more = total > items.length ? `\n(${total - items.length} more; narrow filters to see them)` : "";
    return [`${total} match:\n${items.map(tournamentLine).join("\n")}${more}`, items];
  },
  {
    name: "search_tournaments",
    description:
      "Hybrid semantic + keyword search over upcoming poker tournaments. Put the player's intent in q (e.g. 'deep structure bounty for recreational players'); use filters for hard constraints; sort=popular for trending/most popular.",
    schema: SearchInput,
    responseFormat: "content_and_artifact",
  },
);

export const getTournamentTool = tool(
  async ({ id }): Promise<[string, Tournament[]]> => {
    const t = await getStore().get(id);
    if (t) recordEngagement(t.id, "chat");
    return t ? [tournamentDetail(t), [t]] : [`No tournament with id ${id}`, []];
  },
  {
    name: "get_tournament",
    description: "Full details for one tournament by id.",
    schema: z.object({ id: z.string() }),
    responseFormat: "content_and_artifact",
  },
);

export const TOOLS = [searchTool, getTournamentTool];
