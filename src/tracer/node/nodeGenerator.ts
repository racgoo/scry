import { TraceDetail, TraceEvent } from "../record/index.js";
import { TraceNode } from "./type.js";

/**
 * Generator for TraceNode
 */
class NodeGenerator {
  constructor() {}
  /**
   * Generate trace nodes from trace details
   * 1. Generate trace node map from trace details
   * 2. Reverse trace node map(only chained traces)
   * 3. Convert reversed trace node map to trace nodes(trees)
   */
  public generateNodesWithTraceDetails(details: TraceDetail[]) {
    //Generate trace node map from trace details
    const traceNodeMap = this.generateTraceNodeMap(details);
    //Reverse trace node map(only chained traces)
    const reversedTraceNodeMap = this.reverseChainedNodeMap(
      details,
      traceNodeMap
    );
    //Convert reversed trace node map to trace nodes(trees)
    const traceNodes =
      this.convertTraceNodeMapToTraceNodes(reversedTraceNodeMap);
    return traceNodes;
  }

  /**
   * Generate trace node map from trace details(initial trace node map)
   * 1. Generate initial trace node with trace detail(enter event)
   * 2. Update trace node state with trace detail(returnValue, completed, errored)(exit event)
   * 3. Return trace node map
   */
  private generateTraceNodeMap(details: TraceDetail[]): Map<number, TraceNode> {
    const traceNodeMap = new Map<number, TraceNode>();
    for (const detail of details) {
      switch (detail.type) {
        case TraceEvent.ENTER: {
          const newTraceNode = this.generateTraceNodeWithTraceDetail(detail);
          traceNodeMap.set(detail.traceId, newTraceNode);
          break;
        }
        case TraceEvent.EXIT: {
          const currentTraceNode = traceNodeMap.get(detail.traceId);
          if (currentTraceNode) {
            this.updateTraceNodeState(detail, currentTraceNode);
          }
          break;
        }
        default:
          break;
      }
    }
    return traceNodeMap;
  }

  /**
   * Generate initial trace node with trace detail
   */
  private generateTraceNodeWithTraceDetail(detail: TraceDetail) {
    const newTraceNode: TraceNode = {
      parent: null,
      errored: false,
      traceId: detail.traceId,
      name: detail.name,
      source: detail.source,
      functionCode: detail.functionCode,
      methodCode: detail.methodCode,
      classCode: detail.classCode,
      args: detail.args || [],
      children: [],
      completed: false,
      chained: detail.chained,
      parentTraceId: detail.parentTraceId,
    };
    return newTraceNode;
  }

  /**
   * Update trace node state with trace detail(returnValue, completed, errored)
   */
  private updateTraceNodeState(detail: TraceDetail, traceNode: TraceNode) {
    traceNode.returnValue = detail.returnValue;
    traceNode.completed = true;
    traceNode.errored = detail.returnValue instanceof Error;
  }

  /**
   * Reverse trace node map(only chained traces)
   * 1. Extract reversed chained trace id groups(chained trace id groups)
   * 2. Update trace node map state with chained trace id groups(parent, chain info)
   * 3. Sort by trace id and chain index
   * 4. Return reversed trace node map
   */
  private reverseChainedNodeMap(
    nodeDetails: TraceDetail[],
    nodeMap: Map<number, TraceNode>
  ) {
    //Extract reversed chained trace id groups
    const reversedChainedTraceIdGroups =
      this.getReversedChainedTraceIdGroups(nodeDetails);
    //Update trace node map state with chained trace id groups(parent, chain info)
    this.updateTraceNodeMapStateWithChainedTraceIdGroups(
      nodeMap,
      reversedChainedTraceIdGroups
    );
    //Sort by trace id and chain index(must be chain node, if same start trace id, sort by chain index)
    const newTraceNodeMap = this.sortInsertionOrderedTraceNodeMap(nodeMap);
    return newTraceNodeMap;
  }

  /**
   * Get reversed chained trace id groups
   * babel plugin emit trace event reversed order when chained execution.
   * so, we need to get reversed chained trace id groups.
   * ex.
   * origin detail order => {
   * test1.map(traceId: 1).reduce(traceId: 2).then(traceId: 3);
   * test2.map(traceId: 4).reduce(traceId: 5).then(traceId: 6);
   * } as [3,2,1,6,5,4]
   * reversed chained trace id groups => [[1,2,3],[4,5,6]]
   * !sorry, this logic is not good. and hard to understand.!
   */
  private getReversedChainedTraceIdGroups(
    nodeDetails: TraceDetail[]
  ): number[][] {
    //Chained trace id groups(chained trace id group is member of array)
    const reversedChainedTraceIdGroups: number[][] = [];
    //Only one chain list(ex. .map(traceId: 1).reduce(traceId: 2).then(traceId: 3) as [1,2,3])
    const currentreversedChainedTraceIdGroup: number[] = [];
    //Same chained trace id group flag
    let sameChainedTraceIdGroup = false;
    nodeDetails.some((detail) => {
      const { chained, type } = detail;
      //If type is exit, return false(just "Enter" event is needed)
      if (type === TraceEvent.EXIT) {
        return false;
      }
      // Start accumulating trace IDs when `chained` is true and `sameChainedTraceIdGroup` is false.
      // The condition `chained && !sameChainedTraceIdGroup` indicates that the current detail is the last chained detail in a chaining group.
      // If the previous detail is the start of a chaining group, we set `sameChainedTraceIdGroup` to false.
      // If a non-chained detail (not part of a chaining call) appears, this logic does not work.
      // In other words, accumulation does not happen not only for the first chained detail, but also if a non-chained detail interrupts the chain.
      // This is because chaining is handled synchronously.
      if (chained && !sameChainedTraceIdGroup) {
        //Delcare from now on, it's new chained trace id group.
        sameChainedTraceIdGroup = true;
      }
      //Add trace id to currentReversedChainTraceIds(for every chained node)
      if (sameChainedTraceIdGroup) {
        currentreversedChainedTraceIdGroup.push(detail.traceId);
      }
      //If chained is false and sameChainedTraceIdGroup is true, it's first chained detail.
      //so, push currentreversedChainedTraceIdGroup to reversedChainedTraceIdGroups.
      //end chain with chainging 'sameChainedTraceIdGroup' to false and initialize currentreversedChainedTraceIdGroup.
      if (!chained && sameChainedTraceIdGroup) {
        //End accumulating
        sameChainedTraceIdGroup = false;
        //Save current chained group
        reversedChainedTraceIdGroups.push(
          currentreversedChainedTraceIdGroup.slice()
        );
        //Initialize currentreversedChainedTraceIdGroup for next chained group
        currentreversedChainedTraceIdGroup.length = 0;
      }
    });
    return reversedChainedTraceIdGroups;
  }

  /**
   * Update trace node map state with chained trace id groups(parent, chain info)
   */
  private updateTraceNodeMapStateWithChainedTraceIdGroups(
    traceNodeMap: Map<number, TraceNode>,
    reversedChainedTraceIdGroups: number[][]
  ) {
    //Iterate reversedChainedTraceIdGroups for updating trace node map state
    reversedChainedTraceIdGroups.some((reversedChainedTraceIdGroup) => {
      //Chain root parent trace id(first chained trace's parent trace id)
      const rootParentTraceId = traceNodeMap.get(
        reversedChainedTraceIdGroup[0]
      )?.parentTraceId;
      //First chained trace's trace id
      const chainRootTraceId = traceNodeMap.get(
        reversedChainedTraceIdGroup[reversedChainedTraceIdGroup.length - 1]
      )!.traceId;
      //Setup parent trace id as root parent trace id,and add chain info(for display)
      for (let i = 0; i < reversedChainedTraceIdGroup.length; i++) {
        const currentNode = traceNodeMap.get(reversedChainedTraceIdGroup[i])!;
        currentNode.parentTraceId = rootParentTraceId;
        currentNode.chainInfo = {
          //Chain start trace id(first chained trace's trace id)
          startTraceId: chainRootTraceId,
          //Chain index(chained trace's index, from first to last)
          index: reversedChainedTraceIdGroup.length - i,
        };
      }
    });
  }

  /**
   * Sort trace node map by trace id and chain index(must be chain node, if same start trace id, sort by chain index)
   * because, Map is ordered by insertion order, so we need to sort by trace id and chain index.
   * return sorted trace node map
   */
  private sortInsertionOrderedTraceNodeMap(
    traceNodeMap: Map<number, TraceNode>
  ): Map<number, TraceNode> {
    //Create new trace node map, because, Map is ordered by insertion order
    const newTraceNodeMap = new Map<number, TraceNode>();
    //Sort and update newTraceNodeMap
    Array.from(traceNodeMap.values())
      //Sort by trace id(sort by trace id, because trace id sort must be first srt)
      .sort((a, b) => {
        if (a.traceId && b.traceId) {
          return a.traceId - b.traceId;
        }
        return 0;
      })
      //Sort by chain index(chained sort must be second sort)
      //must be chain node, when same start trace id, sort by chain index
      //
      .sort((a, b) => {
        if (a.chainInfo && b.chainInfo) {
          if (a.chainInfo.startTraceId === b.chainInfo.startTraceId) {
            return a.chainInfo.index - b.chainInfo.index;
          }
        }
        return 0;
      })
      .some((node) => {
        //insert sorted node to newTraceNodeMap
        newTraceNodeMap.set(node.traceId, node);
      });
    return newTraceNodeMap;
  }

  /**
   * Convert trace node map to trace nodes
   * Just make trace nodes trees from trace node map
   */
  private convertTraceNodeMapToTraceNodes(
    traceNodeMap: Map<number, TraceNode>
  ) {
    const traceNodes: TraceNode[] = [];
    //iterate trace node map
    for (const currentTraceNode of traceNodeMap.values()) {
      const parentTraceId = currentTraceNode.parentTraceId;
      //get parent trace node
      const parentTraceNode = traceNodeMap.get(parentTraceId!);
      if (parentTraceNode) {
        //if parent trace node is exist, add current trace node to parent trace node's children
        parentTraceNode.children.push(currentTraceNode);
        currentTraceNode.parent = parentTraceNode;
      } else {
        //if parent trace node is not exist, it's root trace node
        traceNodes.push(currentTraceNode);
      }
    }
    return traceNodes;
  }
}

export { NodeGenerator };
