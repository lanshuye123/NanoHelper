import { describe, expect, it } from 'vitest'
import { parseSymmetryOperation, applySymOp, expandAtoms } from '@/core/crystallography/symmetry'
import { parseCifText, parseCif, interpretCif } from '@/core/crystallography/cif'
import { buildStructureFromCif } from '@/core/crystallography/structureBuilder'

const naclCif = `
data_NaCl
_cell_length_a 5.6402
_cell_length_b 5.6402
_cell_length_c 5.6402
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_space_group_name_H-M 'F m -3 m'
_symmetry_Int_Tables_number 225
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Na1 Na 0 0 0 1
Cl1 Cl 0.5 0 0 1
`

const explicitOpsCif = `
data_test
_cell_length_a 4
_cell_length_b 4
_cell_length_c 4
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
_space_group_symop_operation_xyz
'x, y, z'
'-x, -y, -z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0.25 0.25 0.25
`

describe('symmetry operations', () => {
  it('parses fractions and negative terms', () => {
    const op = parseSymmetryOperation('-x+1/2, y, -z+1/3')
    expect(op.r[0]).toEqual([-1, 0, 0])
    expect(op.t[0]).toBeCloseTo(0.5, 10)
    expect(op.t[2]).toBeCloseTo(1 / 3, 10)
  })

  it('parses two-variable terms', () => {
    const op = parseSymmetryOperation('-y+1/4, x+3/4, z+1/4')
    expect(op.r[0]).toEqual([0, -1, 0])
    expect(op.r[1]).toEqual([1, 0, 0])
    expect(op.t[1]).toBeCloseTo(0.75, 10)
  })

  it('applies an operation and wraps into the cell', () => {
    const op = parseSymmetryOperation('-x, y, -z')
    expect(applySymOp(op, { x: 0.2, y: 0.3, z: 0.4 })).toEqual({ x: 0.8, y: 0.3, z: 0.6 })
  })

  it('deduplicates equivalent positions', () => {
    const ops = [
      parseSymmetryOperation('x, y, z'),
      parseSymmetryOperation('-x, -y, -z'),
    ]
    const atoms = expandAtoms(
      [{ element: 'C', x: 0.25, y: 0.25, z: 0.25 }],
      ops,
    )
    expect(atoms).toHaveLength(2)
  })
})

describe('CIF parser', () => {
  it('reads cell parameters with uncertainties and atom sites', () => {
    const parsed = parseCifText(naclCif)
    expect(parsed.cell?.a).toBeCloseTo(5.6402, 6)
    expect(parsed.spaceGroupNumber).toBe(225)
    expect(parsed.atoms).toHaveLength(2)
    expect(parsed.atoms[0].element).toBe('Na')
    expect(parsed.atoms[1].x).toBeCloseTo(0.5, 8)
  })

  it('reads explicit symmetry operations', () => {
    const data = parseCif(explicitOpsCif)
    const parsed = interpretCif(data)
    expect(parsed.ops).toHaveLength(2)
    expect(parsed.atoms).toHaveLength(1)
  })

  it('expands a CIF using the space-group database when ops are absent', async () => {
    const result = await buildStructureFromCif(naclCif)
    expect(result.structure.atoms).toHaveLength(8)
    expect(result.spaceGroupNumber).toBe(225)
    expect(result.structure.atoms.filter((a) => a.element === 'Na')).toHaveLength(4)
    expect(result.structure.atoms.filter((a) => a.element === 'Cl')).toHaveLength(4)
  })

  it('keeps explicit ops when present', async () => {
    const result = await buildStructureFromCif(explicitOpsCif)
    expect(result.structure.atoms).toHaveLength(2)
  })

  it('handles a semicolon text field and comments', () => {
    const text = `
# a comment
data_x
_cell_length_a 5.0(1)
_cell_length_b 5.0
_cell_length_c 5.0
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_publ_section_title
;
A title that spans
multiple lines
;
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si1 Si 0 0 0
`
    const parsed = parseCifText(text)
    expect(parsed.cell?.a).toBeCloseTo(5.0, 6)
    expect(parsed.title).toContain('multiple lines')
    expect(parsed.atoms).toHaveLength(1)
  })
})

describe('CIF2 dotted tags', () => {
  it('accepts _cell.length_a and _atom_site.fract_x', async () => {
    const text = `
data_test
_cell.length_a 5
_cell.length_b 5
_cell.length_c 5
_cell.angle_alpha 90
_cell.angle_beta 90
_cell.angle_gamma 90
loop_
_atom_site.label
_atom_site.type_symbol
_atom_site.fract_x
_atom_site.fract_y
_atom_site.fract_z
Si1 Si 0 0 0
`
    const parsed = parseCifText(text)
    expect(parsed.cell?.a).toBe(5)
    expect(parsed.atoms).toHaveLength(1)
  })
})
