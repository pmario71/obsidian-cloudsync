# Diff Match and Merge Process

The following diagrams illustrate how CloudSync performs line-level file comparison and merging.

## Line-Level Diff Process

```mermaid
graph TD
    subgraph Input
        L[Local File] --> Split1[Split into lines]
        R[Remote File] --> Split2[Split into lines]
        C[Cache File] --> Split3[Split into lines]
    end

    subgraph Line Processing
        Split1 --> Hash1[Calculate line hashes]
        Split2 --> Hash2[Calculate line hashes]
        Split3 --> Hash3[Calculate line hashes]
    end

    subgraph Comparison
        Hash1 --> Diff1[Compare with Cache]
        Hash2 --> Diff2[Compare with Cache]
        Hash3 --> |Reference| Diff1
        Hash3 --> |Reference| Diff2
    end

    subgraph Changes Detection
        Diff1 --> Local[Local Changes]
        Diff2 --> Remote[Remote Changes]
        Local --> Analyze[Analyze Changes]
        Remote --> Analyze
    end
```

## Line-Level Merge Process

```mermaid
sequenceDiagram
    participant Local
    participant Cache
    participant Remote
    participant Merger

    Note over Local,Remote: Start with three versions

    Merger->>Local: Get line changes
    Merger->>Remote: Get line changes
    Merger->>Cache: Get base version

    Note over Merger: Process line by line

    loop For each line
        alt No changes
            Merger->>Merger: Keep original line
        else Local change only
            Merger->>Merger: Accept local change
        else Remote change only
            Merger->>Merger: Accept remote change
        else Both changed differently
            Merger->>Merger: Mark conflict
        end
    end

    Note over Merger: Resolve conflicts

    alt No conflicts
        Merger-->>Local: Apply merged result
    else Has conflicts
        Merger-->>Local: Keep local version
        Note over Local: Mark for manual resolution
    end
```

## Example Merge Scenarios

### Scenario 1: Non-conflicting Changes
```
Base (Cache):
Line 1: Hello
Line 2: World
Line 3: !

Local:
Line 1: Hello there
Line 2: World
Line 3: !

Remote:
Line 1: Hello
Line 2: Beautiful World
Line 3: !

Result:
Line 1: Hello there
Line 2: Beautiful World
Line 3: !
```

### Scenario 2: Conflicting Changes
```
Base (Cache):
Line 1: Hello
Line 2: World
Line 3: !

Local:
Line 1: Hello there
Line 2: World
Line 3: !

Remote:
Line 1: Hi there
Line 2: World
Line 3: !

Result (Conflict):
Line 1: -Hello there
Line 2: +Hi there
Line 3: World
Line 4: !
```

## Key Features

1. **Three-Way Comparison**
   - Uses cached version as base reference
   - Compares both local and remote changes against base
   - Enables accurate conflict detection

2. **Line-Level Granularity**
   - Processes files line by line
   - Maintains line order and structure
   - Preserves unmodified lines

3. **Smart Merge Resolution**
   - Automatically merges non-conflicting changes
   - Identifies and marks conflicting changes
   - Preserves local changes in conflict cases

4. **Change Detection**
   - Identifies line additions
   - Detects line deletions
   - Recognizes line modifications

5. **Conflict Handling**
   - Marks conflicts clearly in the output
   - Preserves both versions in conflict cases
   - Enables manual conflict resolution
